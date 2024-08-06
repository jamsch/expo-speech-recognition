import AVFoundation
import Foundation
import Speech

enum RecognizerError: Error {
  case nilRecognizer
  case notAuthorizedToRecognize
  case notPermittedToRecord
  case recognizerIsUnavailable
  case invalidAudioSource
  case audioInputBusy

  var message: String {
    switch self {
    case .nilRecognizer:
      return "Can't initialize speech recognizer. Ensure the locale is supported by the device."
    case .notAuthorizedToRecognize: return "Not authorized to recognize speech"
    case .notPermittedToRecord: return "Not permitted to record audio"
    case .recognizerIsUnavailable: return "Recognizer is unavailable"
    case .invalidAudioSource: return "Invalid audio source"
    case .audioInputBusy: return "The audio input is busy"
    }
  }
}

/// A helper for transcribing speech to text using SFSpeechRecognizer and AVAudioEngine.
actor ExpoSpeechRecognizer: ObservableObject {

  private var options: SpeechRecognitionOptions?
  private var audioEngine: AVAudioEngine?
  private var request: SFSpeechRecognitionRequest?
  private var task: SFSpeechRecognitionTask?
  private var recognizer: SFSpeechRecognizer?
  private var speechStartHandler: (() -> Void)?
  private var audioFileRef: ExtAudioFileRef?
  private var outputFileUrl: URL?
  /// Whether the recognizer has been stopped by the user or the timer has timed out
  private var stoppedListening = false

  /// Detection timer, for non-continuous speech recognition
  @MainActor var detectionTimer: Timer?

  @MainActor var endHandler: (() -> Void)?
  @MainActor var audioEndHandler: ((String?) -> Void)?

  /// Initializes a new speech recognizer. If this is the first time you've used the class, it
  /// requests access to the speech recognizer and the microphone.
  init(
    locale: Locale
  ) async throws {

    recognizer = SFSpeechRecognizer(
      locale: locale
    )

    guard recognizer != nil else {
      throw RecognizerError.nilRecognizer
    }

    guard await SFSpeechRecognizer.hasAuthorizationToRecognize() else {
      throw RecognizerError.notAuthorizedToRecognize
    }

    guard await AVAudioSession.sharedInstance().hasPermissionToRecord() else {
      throw RecognizerError.notPermittedToRecord
    }
  }

  /// Returns a suitable audio format to use for the speech recognition task and audio file recording.
  private static func getAudioFormat(forEngine engine: AVAudioEngine) -> AVAudioFormat {
    return engine.inputNode.outputFormat(forBus: 0)

    // let format = engine.inputNode.outputFormat(forBus: 0)
    // if format.sampleRate > 0 {
    //   return format
    // }
    // print("WARN: returning custom audio format")
    // return AVAudioFormat(
    //   standardFormatWithSampleRate: AVAudioSession.sharedInstance().sampleRate,
    //   channels: 1
    // )!
  }

  private static func getFileAudioFormat(
    options: SpeechRecognitionOptions, engine: AVAudioEngine
  ) -> AVAudioFormat? {

    var commonFormat: AVAudioCommonFormat = .pcmFormatFloat32

    if let outputEncoding = options.recordingOptions?.outputEncoding {
      switch outputEncoding {
      case "pcmFormatFloat32":
        commonFormat = .pcmFormatFloat32
      case "pcmFormatFloat64":
        commonFormat = .pcmFormatFloat64
      case "pcmFormatInt16":
        commonFormat = .pcmFormatInt16
      case "pcmFormatInt32":
        commonFormat = .pcmFormatInt32
      default:
        print(
          "[expo-speech-recognition] Unsupported encoding: \(outputEncoding). Using default pcmFormatFloat32."
        )
      }
    }

    // Whether we should be downsampling the audio
    if let outputSampleRate = options.recordingOptions?.outputSampleRate {
      print("commonFormat: \(commonFormat), sample rate: \(outputSampleRate)")
      return AVAudioFormat(
        commonFormat: commonFormat,
        sampleRate: outputSampleRate,
        channels: 1,
        interleaved: false
      )
    }
    return engine.inputNode.outputFormat(forBus: 0)
  }

  func getLocale() -> String? {
    return recognizer?.locale.identifier
  }

  @MainActor func start(
    options: SpeechRecognitionOptions,
    resultHandler: @escaping (SFSpeechRecognitionResult) -> Void,
    errorHandler: @escaping (Error) -> Void,
    endHandler: (() -> Void)?,
    startHandler: @escaping (() -> Void),
    speechStartHandler: @escaping (() -> Void),
    audioStartHandler: @escaping (String?) -> Void,
    audioEndHandler: @escaping (String?) -> Void
  ) {
    self.endHandler = endHandler
    self.audioEndHandler = audioEndHandler
    Task {
      await startRecognizer(
        options: options,
        resultHandler: resultHandler,
        errorHandler: errorHandler,
        startHandler: startHandler,
        speechStartHandler: speechStartHandler,
        audioStartHandler: audioStartHandler
      )
    }
  }

  /// Stops the speech recognizer.
  /// Attempts to emit a final result if the speech recognizer is still running.
  @MainActor func stop() {
    Task {
      let taskState = await task?.state
      // Check if the recognizer is running
      // If it is, then just run the stopListening function
      if taskState == .running || taskState == .starting {
        await stopListening()
      } else {
        // Task isn't likely running, just reset and emit an end event
        await reset(andEmitEnd: true)
      }
    }
  }

  /// Cancels the current speech recognition task.
  /// This is different from `stop` in that the recognition task is immediately cancelled and no
  /// final result is emitted.
  @MainActor func abort() {
    Task {
      await reset(andEmitEnd: true)
    }
  }

  ///
  /// Returns the state of the speech recognizer task
  /// type SpeechRecognitionState =
  ///  | "inactive"
  ///  | "starting"
  ///  | "recognizing"
  ///  | "stopping";
  func getState() -> String {
    switch task?.state {
    case .none:
      return "inactive"
    case .some(.starting), .some(.running):
      return "recognizing"
    case .some(.canceling):
      return "stopping"
    default:
      return "inactive"
    }
  }

  /// Begin transcribing audio.
  ///
  /// Creates a `SFSpeechRecognitionTask` that transcribes speech to text until you call `stop()`.
  private func startRecognizer(
    options: SpeechRecognitionOptions,
    resultHandler: @escaping (SFSpeechRecognitionResult) -> Void,
    errorHandler: @escaping (Error) -> Void,
    startHandler: @escaping () -> Void,
    speechStartHandler: @escaping () -> Void,
    audioStartHandler: @escaping (String?) -> Void
  ) {
    // Reset the speech recognizer before starting
    reset(andEmitEnd: false)

    self.outputFileUrl = nil
    self.speechStartHandler = speechStartHandler

    guard let recognizer, recognizer.isAvailable else {
      errorHandler(RecognizerError.recognizerIsUnavailable)
      reset(andEmitEnd: true)
      return
    }

    do {
      let request = Self.prepareRequest(
        options: options,
        recognizer: recognizer
      )
      self.request = request

      // Check if options.audioSource is set, if it is, then it is sourced from a file
      let isSourcedFromFile = options.audioSource?.uri != nil

      if isSourcedFromFile {
        // If we're doing file-based recognition we don't need to create an audio engine
        self.audioEngine = nil
      } else {
        // Set up the audio session to get the correct audio format
        try Self.setupAudioSession(options.iosCategory)

        self.audioEngine = AVAudioEngine()

        guard let audioEngine = self.audioEngine else {
          print("expo-speech-recognition: ERROR - Failed to create AVAudioEngine")
          throw RecognizerError.invalidAudioSource
        }

        let inputNode = audioEngine.inputNode
        // Note: accessing `inputNode.outputFormat(forBus: 0)` may crash the thread with the error:
        // `required condition is false: format.sampleRate == hwFormat.sampleRate`
        // (under the hood it calls `AVAudioEngineImpl::UpdateInputNode` -> `AVAudioNode setOutputFormat:forBus:0`)
        let audioFormat = Self.getAudioFormat(forEngine: audioEngine)

        // Check if the microphone is busy
        guard !Self.audioInputIsBusy(audioFormat) else {
          print(
            "expo-speech-recognition: ERROR - input is busy \(audioFormat)"
          )
          throw RecognizerError.audioInputBusy
        }

        let mixerNode = AVAudioMixerNode()
        audioEngine.attach(mixerNode)
        audioEngine.connect(inputNode, to: mixerNode, format: audioFormat)

        // Feature: file recording
        if options.recordingOptions?.persist == true {
          guard
            let fileAudioFormat = Self.getFileAudioFormat(
              options: options,
              engine: audioEngine
            )
          else {
            print(
              "expo-speech-recognition: ERROR - Failed to create AVAudioFormat from given sample rate"
            )
            throw RecognizerError.invalidAudioSource
          }

          let outputUrl = prepareFileWriter(
            outputDirectory: options.recordingOptions?.outputDirectory,
            outputFileName: options.recordingOptions?.outputFileName,
            audioFormat: fileAudioFormat
          )
          self.outputFileUrl = outputUrl
        }

        // Set up audio recording & sink to recognizer/file
        try Self.prepareEngine(
          audioEngine: audioEngine,
          mixerNode: mixerNode,
          options: options,
          request: request,
          audioFileRef: self.audioFileRef
        )
      }

      // Don't run any timers if the audio source is from a file
      let continuous = options.continuous || isSourcedFromFile
      let audioEngine = self.audioEngine

      self.task = recognizer.recognitionTask(
        with: request,
        resultHandler: { [weak self] result, error in
          // Speech start event
          if result != nil && error == nil {
            Task { [weak self] in
              await self?.handleSpeechStart()
            }
          }

          // Result handler
          self?.recognitionHandler(
            audioEngine: audioEngine,
            result: result,
            error: error,
            resultHandler: resultHandler,
            errorHandler: errorHandler,
            continuous: continuous
          )
        })

      if !continuous {
        invalidateAndScheduleTimer()
      }

      // Emit the "start" event to indicate that speech recognition has started
      startHandler()

      // If user has opted in to recording, emit an "audiostart" event with the path
      audioStartHandler(outputFileUrl?.path)
    } catch {
      errorHandler(error)
      reset(andEmitEnd: true)
    }
  }

  private func prepareFileWriter(
    outputDirectory: String?,
    outputFileName: String?,
    audioFormat: AVAudioFormat
  ) -> URL? {
    let baseDir: URL

    if let outputDirectory = outputDirectory {
      baseDir = URL(fileURLWithPath: outputDirectory, isDirectory: true)
    } else {
      guard let dirPath = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
      else {
        print("Failed to get cache directory path.")
        return nil
      }
      baseDir = dirPath
    }

    let fileName = outputFileName ?? "recording_\(UUID().uuidString).caf"
    let filePath = baseDir.appendingPathComponent(fileName)

    _ = ExtAudioFileCreateWithURL(
      filePath as CFURL,
      kAudioFileWAVEType,
      audioFormat.streamDescription,
      nil,
      AudioFileFlags.eraseFile.rawValue,
      &audioFileRef
    )

    // Note: using `AVAudioFile()` doesn't seem to work
    // when downsampling pcmFloat32 to pcmInt16

    // let file = try AVAudioFile(
    //   forWriting: filePath,
    //   settings: audioFormat.settings
    // )

    return filePath
  }

  private func handleSpeechStart() {
    speechStartHandler?()
    speechStartHandler = nil
  }

  private func end() {
    let filePath = self.outputFileUrl?.path
    outputFileUrl = nil
    Task {
      await MainActor.run {
        self.audioEndHandler?(filePath)
        self.audioEndHandler = nil
        self.endHandler?()
      }
    }
  }

  private func stopListening() {
    // Prevent double entry
    // e.g. when the user presses the stop button twice
    // or timer timeout + user interaction
    if stoppedListening {
      return
    }
    stoppedListening = true
    if let request = request as? SFSpeechAudioBufferRecognitionRequest {
      request.endAudio()
    }
    if audioEngine?.isRunning ?? false {
      audioEngine?.stop()
      audioEngine?.inputNode.removeTap(onBus: 0)
      audioEngine?.inputNode.reset()
      audioEngine?.reset()
      audioEngine = nil
    }

    task?.finish()
  }

  /// Reset the speech recognizer.
  private func reset(andEmitEnd: Bool = false) {
    let taskWasRunning = task != nil
    let shouldEmitEndEvent = andEmitEnd || taskWasRunning || stoppedListening

    stoppedListening = false
    task?.cancel()
    audioEngine?.stop()
    audioEngine?.inputNode.removeTap(onBus: 0)
    audioEngine?.inputNode.reset()
    audioEngine?.reset()
    audioEngine = nil

    if let audioFileRef = audioFileRef {
      ExtAudioFileDispose(audioFileRef)
    }
    audioFileRef = nil
    request = nil
    task = nil
    speechStartHandler = nil
    invalidateDetectionTimer()

    // If the task was running, emit the end handler
    // This avoids emitting the end handler multiple times
    // Unless we really need to emit the end event
    // (e.g. in the case of a setup error)
    print("SpeechRecognizer: end")
    if shouldEmitEndEvent {
      end()
    }
  }

  private static func prepareRequest(
    options: SpeechRecognitionOptions, recognizer: SFSpeechRecognizer
  ) -> SFSpeechRecognitionRequest {

    let request: SFSpeechRecognitionRequest
    if let audioSource = options.audioSource {
      request = SFSpeechURLRecognitionRequest(url: URL(string: audioSource.uri)!)
    } else {
      request = SFSpeechAudioBufferRecognitionRequest()
    }

    request.shouldReportPartialResults = options.interimResults

    if recognizer.supportsOnDeviceRecognition {
      request.requiresOnDeviceRecognition = options.requiresOnDeviceRecognition
    }

    if let taskHint = options.iosTaskHint {
      request.taskHint = taskHint.sfSpeechRecognitionTaskHint
    }

    if let contextualStrings = options.contextualStrings {
      request.contextualStrings = contextualStrings
    }

    if #available(iOS 16, *) {
      request.addsPunctuation = options.addsPunctuation
    }

    return request
  }

  private static func setupAudioSession(_ options: SetCategoryOptions?) throws {
    let audioSession = AVAudioSession.sharedInstance()

    if let options: SetCategoryOptions {
      // Convert the array of category options to a bitmask
      let categoryOptions = options.categoryOptions.reduce(
        AVAudioSession.CategoryOptions()
      ) {
        result, option in
        result.union(option.avCategoryOption)
      }
      try audioSession.setCategory(
        options.category.avCategory,
        mode: options.mode.avMode,
        options: categoryOptions
      )
    } else {
      // Default to playAndRecord with defaultToSpeaker and allowBluetooth
      try audioSession.setCategory(
        .playAndRecord,
        mode: .measurement,
        options: [.defaultToSpeaker, .allowBluetooth]
      )
    }

    try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
  }

  private static func audioInputIsBusy(_ recordingFormat: AVAudioFormat) -> Bool {
    guard recordingFormat.sampleRate == 0 || recordingFormat.channelCount == 0 else {
      return false
    }
    return true
  }

  private static func prepareEngine(
    audioEngine: AVAudioEngine,
    mixerNode: AVAudioMixerNode,
    options: SpeechRecognitionOptions,
    request: SFSpeechRecognitionRequest,
    audioFileRef: ExtAudioFileRef?
  ) throws {
    guard let audioBufferRequest = request as? SFSpeechAudioBufferRecognitionRequest else {
      throw RecognizerError.invalidAudioSource
    }

    let audioFormat = Self.getAudioFormat(forEngine: audioEngine)

    let shouldDownsample = options.recordingOptions?.outputSampleRate != nil
    var converter: AVAudioConverter?
    var fileOutputFormat: AVAudioFormat?

    if shouldDownsample {
      fileOutputFormat = Self.getFileAudioFormat(
        options: options,
        engine: audioEngine
      )
      guard let unwrappedFileOutputFormat = fileOutputFormat else {
        throw RecognizerError.invalidAudioSource
      }
      converter = AVAudioConverter(from: audioFormat, to: unwrappedFileOutputFormat)
      // converter?.channelMap = [0]
    }

    mixerNode.installTap(
      onBus: 0,
      bufferSize: 1024,
      format: audioFormat
    ) {
      (buffer: AVAudioPCMBuffer, when: AVAudioTime) in
      audioBufferRequest.append(buffer)

      // Feature: Record to a file
      guard let audioFileRef = audioFileRef else {
        return
      }

      if !shouldDownsample {
        ExtAudioFileWrite(audioFileRef, buffer.frameLength, buffer.audioBufferList)
      } else {
        guard let outputFormat = fileOutputFormat, let converter = converter else {
          return
        }
        Self.downsampleToFile(
          buffer: buffer, audioFileRef: audioFileRef, converter: converter,
          downsampledFormat: outputFormat)
      }
    }

    audioEngine.prepare()
    try audioEngine.start()
  }

  /// Downsamples the audio buffer to a file ref
  private static func downsampleToFile(
    buffer: AVAudioPCMBuffer,
    audioFileRef: ExtAudioFileRef?,
    converter: AVAudioConverter,
    downsampledFormat: AVAudioFormat
  ) {
    guard let audioFileRef = audioFileRef else {
      print("Error: Could not create output file.")
      return
    }

    let sampleRateRatio = buffer.format.sampleRate / downsampledFormat.sampleRate
    let outputCapacity = AVAudioFrameCount(Double(buffer.frameCapacity) / sampleRateRatio)

    guard
      let convertedBuffer = AVAudioPCMBuffer(
        pcmFormat: downsampledFormat,
        frameCapacity: outputCapacity
      )
    else {
      print("Error: Could not create converted buffer.")
      return
    }

    var conversionError: NSError?
    let status = converter.convert(to: convertedBuffer, error: &conversionError) {
      inNumPackets, outStatus in
      outStatus.pointee = .haveData
      return buffer
    }

    if status == .error || conversionError != nil {
      if let error = conversionError {
        print("Conversion error: \(error.localizedDescription)")
      } else {
        print("Conversion error: unknown error")
      }
      return
    }

    ExtAudioFileWrite(audioFileRef, convertedBuffer.frameLength, convertedBuffer.audioBufferList)
  }

  nonisolated private func recognitionHandler(
    audioEngine: AVAudioEngine?,
    result: SFSpeechRecognitionResult?,
    error: Error?,
    resultHandler: @escaping (SFSpeechRecognitionResult) -> Void,
    errorHandler: @escaping (Error) -> Void,
    continuous: Bool
  ) {
    let receivedFinalResult = result?.isFinal ?? false
    let receivedError = error != nil

    if let result: SFSpeechRecognitionResult {
      Task { @MainActor in
        let taskState = await task?.state
        // Make sure the task is running before emitting the result
        if taskState != .none {
          resultHandler(result)
        }
      }
    }

    if let error: Error {
      // TODO: don't emit no-speech if there were already interim results
      Task { @MainActor in
        errorHandler(error)
      }
    }

    if receivedFinalResult || receivedError {
      //      audioEngine?.stop()
      //      audioEngine?.inputNode.removeTap(onBus: 0)
      Task { @MainActor in
        await reset()
      }
    }

    // Non-continuous speech recognition
    // Stop the speech recognizer if the timer fires after not receiving a result for 3 seconds
    if !continuous && !receivedError {
      invalidateAndScheduleTimer()
    }
  }

  nonisolated private func invalidateDetectionTimer() {
    Task { @MainActor in
      self.detectionTimer?.invalidate()
    }
  }

  nonisolated private func invalidateAndScheduleTimer() {
    Task { @MainActor in
      let taskState = await task?.state

      self.detectionTimer?.invalidate()

      // Don't schedule a timer if recognition isn't running
      if taskState == .none {
        return
      }

      self.detectionTimer = Timer.scheduledTimer(
        withTimeInterval: 3,
        repeats: false
      ) { [weak self] _ in
        Task { [weak self] in
          // Stop listening when the timer fires
          // This will finish the current task and emit the final result (or a no-speech event)
          await self?.stopListening()

        }
      }
    }
  }
}

extension SFSpeechRecognizer {
  static func hasAuthorizationToRecognize() async -> Bool {
    await withCheckedContinuation { continuation in
      requestAuthorization { status in
        continuation.resume(returning: status == .authorized)
      }
    }
  }

  static func requestPermissions() async -> SFSpeechRecognizerAuthorizationStatus {
    await withCheckedContinuation { continuation in
      requestAuthorization { status in
        continuation.resume(returning: status)
      }
    }
  }
}

extension AVAudioSession {
  func hasPermissionToRecord() async -> Bool {
    await withCheckedContinuation { continuation in
      requestRecordPermission { authorized in
        continuation.resume(returning: authorized)
      }
    }
  }
}
