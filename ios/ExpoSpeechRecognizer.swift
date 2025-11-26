import AVFoundation
import Accelerate
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
  @MainActor var volumeChangeHandler: ((Float) -> Void)?

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

  // Update the start method signature to include volumeChangeHandler
  @MainActor func start(
    options: SpeechRecognitionOptions,
    resultHandler: @escaping (SFSpeechRecognitionResult) -> Void,
    errorHandler: @escaping (Error) -> Void,
    endHandler: (() -> Void)?,
    startHandler: @escaping (() -> Void),
    speechStartHandler: @escaping (() -> Void),
    audioStartHandler: @escaping (String?) -> Void,
    audioEndHandler: @escaping (String?) -> Void,
    volumeChangeHandler: @escaping (Float) -> Void
  ) {
    self.endHandler = endHandler
    self.audioEndHandler = audioEndHandler
    self.volumeChangeHandler = volumeChangeHandler
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

    self.options = options
    self.request = nil
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
      let isSourcedFromFile = options.audioSource?.uri != nil

      // Check if options.audioSource is set, if it is, then it is sourced from a file
      if let audioSource = options.audioSource?.uri {
        try prepareFileRecognition(request: request, url: URL(string: audioSource)!)
      } else {
        try prepareMicrophoneRecognition(request: request, options: options)
      }

      startRecognitionTask(
        with: request,
        recognizer: recognizer,
        resultHandler: resultHandler,
        errorHandler: errorHandler,
        continuous: options.continuous,
        canEmitInterimResults: options.interimResults,
        isSourcedFromFile: isSourcedFromFile
      )

      // Emit the "start" event to indicate that speech recognition has started
      startHandler()

      // If user has opted in to recording, emit an "audiostart" event with the path
      audioStartHandler(outputFileUrl?.absoluteString)
    } catch {
      errorHandler(error)
      reset(andEmitEnd: true)
    }
  }

  private func startRecognitionTask(
    with request: SFSpeechRecognitionRequest,
    recognizer: SFSpeechRecognizer,
    resultHandler: @escaping (SFSpeechRecognitionResult) -> Void,
    errorHandler: @escaping (Error) -> Void,
    continuous: Bool,
    canEmitInterimResults: Bool,
    isSourcedFromFile: Bool
  ) {
    let audioEngine = self.audioEngine
    let shouldRunTimers = !continuous && !isSourcedFromFile

    self.task = recognizer.recognitionTask(
      with: request,
      resultHandler: { [weak self] result, error in
        self?.recognitionHandler(
          audioEngine: audioEngine,
          result: result,
          error: error,
          resultHandler: resultHandler,
          errorHandler: errorHandler,
          continuous: continuous,
          shouldRunTimers: shouldRunTimers,
          canEmitInterimResults: canEmitInterimResults,
          isSourcedFromFile: isSourcedFromFile
        )
      }
    )
  }

  private func prepareFileRecognition(request: SFSpeechRecognitionRequest, url: URL) throws {
    self.audioEngine = nil

    guard let request = self.request as? SFSpeechAudioBufferRecognitionRequest else {
      throw RecognizerError.invalidAudioSource
    }

    let chunkDelayMillis: Int
    if let options = self.options, let specifiedDelay = options.audioSource?.chunkDelayMillis {
      chunkDelayMillis = specifiedDelay
    } else if self.options?.requiresOnDeviceRecognition == true {
      chunkDelayMillis = 15  // On-device recognition
    } else {
      chunkDelayMillis = 50  // Network-based recognition
    }
    let chunkDelayNs = UInt64(chunkDelayMillis) * 1_000_000
    // var playbackBuffers = [AVAudioPCMBuffer]()

    Task.detached(priority: .userInitiated) {
      do {
        let file = try AVAudioFile(forReading: url)
        let bufferCapacity: AVAudioFrameCount = 4096
        let inputBuffer = AVAudioPCMBuffer(
          pcmFormat: file.processingFormat, frameCapacity: bufferCapacity
        )!

        while file.framePosition < file.length {
          let framesToRead = min(
            bufferCapacity, AVAudioFrameCount(file.length - file.framePosition)
          )
          try file.read(into: inputBuffer, frameCount: framesToRead)
          request.append(inputBuffer)
          // playbackBuffers.append(inputBuffer.copy() as! AVAudioPCMBuffer)
          try await Task.sleep(nanoseconds: chunkDelayNs)
        }

        print("[expo-speech-recognition]: Audio streaming ended")
        request.endAudio()
        // await self.playBack(playbackBuffers: playbackBuffers)
      } catch {
        print("[expo-speech-recognition]: Error feeding audio file: \(error)")
        request.endAudio()
      }
    }
  }

  private func prepareMicrophoneRecognition(
    request: SFSpeechRecognitionRequest,
    options: SpeechRecognitionOptions
  ) throws {
    try Self.setupAudioSession(options.iosCategory)
    self.audioEngine = AVAudioEngine()

    guard let audioEngine = self.audioEngine else {
      print("expo-speech-recognition: ERROR - Failed to create AVAudioEngine")
      throw RecognizerError.invalidAudioSource
    }

    let inputNode = audioEngine.inputNode
    let audioFormat = Self.getAudioFormat(forEngine: audioEngine)

    guard !Self.audioInputIsBusy(audioFormat) else {
      print("expo-speech-recognition: ERROR - input is busy \(audioFormat)")
      throw RecognizerError.audioInputBusy
    }

    let mixerNode = AVAudioMixerNode()
    audioEngine.attach(mixerNode)
    audioEngine.connect(inputNode, to: mixerNode, format: audioFormat)

    // Configure voice processing if enabled
    if options.iosVoiceProcessingEnabled == true {
      do {
        try audioEngine.inputNode.setVoiceProcessingEnabled(true)
        try audioEngine.outputNode.setVoiceProcessingEnabled(true)
      } catch {
        print(
          "expo-speech-recognition: WARNING - Failed to set voice processing: \(error)"
        )
      }
    }

    if options.recordingOptions?.persist == true {
      guard let fileAudioFormat = Self.getFileAudioFormat(options: options, engine: audioEngine)
      else {
        print(
          "expo-speech-recognition: ERROR - Failed to create AVAudioFormat from given sample rate")
        throw RecognizerError.invalidAudioSource
      }

      self.outputFileUrl = prepareFileWriter(
        outputDirectory: options.recordingOptions?.outputDirectory,
        outputFileName: options.recordingOptions?.outputFileName,
        audioFormat: fileAudioFormat
      )
    }

    try Self.prepareEngine(
      audioEngine: audioEngine,
      mixerNode: mixerNode,
      options: options,
      request: request,
      audioFileRef: self.audioFileRef,
      volumeChangeHandler: { volume in
        Task { @MainActor in
          self.volumeChangeHandler?(volume)
        }
      }
    )

    if !options.continuous {
      invalidateAndScheduleTimer()
    }
  }

  private func prepareFileWriter(
    outputDirectory: String?,
    outputFileName: String?,
    audioFormat: AVAudioFormat
  ) -> URL? {
    let baseDir: URL

    if let outputDirectory = outputDirectory {
      guard let resolvedURL = Self.resolveOutputDirectoryURL(outputDirectory) else {
        print("expo-speech-recognition: ERROR - Invalid outputDirectory: \(outputDirectory)")
        return nil
      }
      baseDir = resolvedURL
    } else {
      guard
        let dirPath = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
      else {
        print("Failed to get cache directory path.")
        return nil
      }
      baseDir = dirPath
    }

    do {
      try FileManager.default.createDirectory(
        at: baseDir,
        withIntermediateDirectories: true
      )
    } catch {
      print("expo-speech-recognition: ERROR - Failed to create output directory: \(error)")
      return nil
    }

    let fileName = outputFileName ?? "recording_\(UUID().uuidString).wav"
    let filePath = baseDir.appendingPathComponent(fileName)

    let status = ExtAudioFileCreateWithURL(
      filePath as CFURL,
      kAudioFileWAVEType,
      audioFormat.streamDescription,
      nil,
      AudioFileFlags.eraseFile.rawValue,
      &audioFileRef
    )

    guard status == noErr else {
      print("expo-speech-recognition: ERROR - Failed to create audio file: \(status)")
      audioFileRef = nil
      return nil
    }

    // Note: using `AVAudioFile()` doesn't seem to work
    // when downsampling pcmFloat32 to pcmInt16

    // let file = try AVAudioFile(
    //   forWriting: filePath,
    //   settings: audioFormat.settings
    // )

    return filePath
  }

  private static func resolveOutputDirectoryURL(_ directory: String) -> URL? {
    if let url = URL(string: directory.trimmingCharacters(in: .whitespacesAndNewlines)),
      let scheme = url.scheme,
      !scheme.isEmpty
    {
      guard url.isFileURL else {
        print("expo-speech-recognition: ERROR - Output directory must be a file URL.")
        return nil
      }
      return url.hasDirectoryPath ? url : url.appendingPathComponent("")
    }

    let expandedDirectory = (directory as NSString).expandingTildeInPath
    return URL(fileURLWithPath: expandedDirectory, isDirectory: true)
  }

  private func handleSpeechStart() {
    speechStartHandler?()
    speechStartHandler = nil
  }

  private func end() {
    let filePath = self.outputFileUrl?.absoluteString
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
    // map through all the attached nodes
    // and remove the tap
    audioEngine?.attachedNodes.forEach(
      { $0.removeTap(onBus: 0) }
    )
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
    options: SpeechRecognitionOptions,
    recognizer: SFSpeechRecognizer
  ) -> SFSpeechRecognitionRequest {
    let request = SFSpeechAudioBufferRecognitionRequest()

    // We also force-enable partial results on non-continuous mode,
    // which will allow us to re-schedule timers when text is detected
    // These won't get emitted to the user, however
    request.shouldReportPartialResults = options.interimResults || !options.continuous

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
    audioFileRef: ExtAudioFileRef?,
    volumeChangeHandler: ((Float) -> Void)?
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

    // Install separate tap with a longer buffer size to listen for volume changes
    if options.volumeChangeEventOptions?.enabled == true {
      let desiredDuration: TimeInterval =
        TimeInterval(options.volumeChangeEventOptions?.intervalMillis ?? 100) / 1000.0
      let bufferSize = AVAudioFrameCount(audioFormat.sampleRate * desiredDuration)

      let volumeMixerNode = AVAudioMixerNode()
      audioEngine.attach(volumeMixerNode)
      audioEngine.connect(mixerNode, to: volumeMixerNode, format: audioFormat)

      volumeMixerNode.installTap(
        onBus: 0,
        bufferSize: bufferSize,
        format: audioFormat
      ) { buffer, when in
        guard let power = Self.calculatePower(buffer: buffer) else { return }

        let minDb: Float = -60.0
        let maxDb: Float = 0.0
        let normalized: Float = (power - minDb) / (maxDb - minDb)  // Normalized to 0.0 - 1.0
        let clampedNormalized = min(max(normalized, 0.0), 1.0)

        let scaledValue = clampedNormalized * (10 - (-2)) + (-2)  // Scaled to -2 - 10

        // Send the volume change event
        volumeChangeHandler?(scaledValue)
      }
    }

    audioEngine.prepare()
    try audioEngine.start()
  }

  private static func calculatePower(buffer: AVAudioPCMBuffer) -> Float? {
    // let channelCount = Int(buffer.format.channelCount)
    let length = vDSP_Length(buffer.frameLength)
    let channel = 0

    if let floatData = buffer.floatChannelData {
      return calculatePowers(data: floatData[channel], strideFrames: buffer.stride, length: length)
    } else if let int16Data = buffer.int16ChannelData {
      // Convert the data from int16 to float values before calculating the power values.
      var floatChannelData: [Float] = Array(repeating: Float(0.0), count: Int(buffer.frameLength))
      vDSP_vflt16(int16Data[channel], buffer.stride, &floatChannelData, buffer.stride, length)
      var scalar = Float(INT16_MAX)
      vDSP_vsdiv(floatChannelData, buffer.stride, &scalar, &floatChannelData, buffer.stride, length)
      return calculatePowers(data: floatChannelData, strideFrames: buffer.stride, length: length)
    } else if let int32Data = buffer.int32ChannelData {
      // Convert the data from int32 to float values before calculating the power values.
      var floatChannelData: [Float] = Array(repeating: Float(0.0), count: Int(buffer.frameLength))
      vDSP_vflt32(int32Data[channel], buffer.stride, &floatChannelData, buffer.stride, length)
      var scalar = Float(INT32_MAX)
      vDSP_vsdiv(floatChannelData, buffer.stride, &scalar, &floatChannelData, buffer.stride, length)
      return calculatePowers(data: floatChannelData, strideFrames: buffer.stride, length: length)
    }

    return nil
  }

  private static func calculatePowers(
    data: UnsafePointer<Float>, strideFrames: Int, length: vDSP_Length
  ) -> Float? {
    let kMinLevel: Float = 1e-7  // -160 dB
    var max: Float = 0.0
    vDSP_maxv(data, strideFrames, &max, length)
    if max < kMinLevel {
      max = kMinLevel
    }
    return 20.0 * log10(max)
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
    continuous: Bool,
    shouldRunTimers: Bool,
    canEmitInterimResults: Bool,
    isSourcedFromFile: Bool
  ) {
    // When a final result is returned, we should expect the task to be idle or stopping
    let receivedFinalResult = result?.isFinal ?? false
    let receivedError = error != nil

    // Hack for iOS 18 to detect final results
    // See: https://forums.developer.apple.com/forums/thread/762952 for more info
    // This can be emitted multiple times during a continuous session, unlike `result.isFinal` which is only emitted once
    var receivedFinalLikeResult: Bool = receivedFinalResult
    if #available(iOS 18.0, *), !receivedFinalLikeResult {
      receivedFinalLikeResult = result?.speechRecognitionMetadata?.speechDuration ?? 0 > 0
    }

    let shouldEmitResult = receivedFinalResult || canEmitInterimResults || receivedFinalLikeResult

    if let result: SFSpeechRecognitionResult, shouldEmitResult {
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
        if await task != nil {
          // Don't emit any errors after the task has finished
          errorHandler(error)
        }
      }
    }

    if receivedError || (receivedFinalLikeResult && !continuous && !isSourcedFromFile)
      || receivedFinalResult
    {
      Task { @MainActor in
        await reset()
      }
      return
    }

    // Non-continuous speech recognition
    // Stop the speech recognizer if the timer fires after not receiving a result for 3 seconds
    if shouldRunTimers && !receivedError {
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

  /*
  private var playbackEngine: AVAudioEngine?
  private var playerNode: AVAudioPlayerNode?
  /// Playback audio from an array of AVAudioPCMBuffers
  /// For testing purposes only
  func playBack(playbackBuffers: [AVAudioPCMBuffer]) {
    guard !playbackBuffers.isEmpty else { return }
  
    playbackEngine = AVAudioEngine()
    playerNode = AVAudioPlayerNode()
  
    guard let playbackEngine = playbackEngine, let playerNode = playerNode else { return }
  
    playbackEngine.attach(playerNode)
    let outputFormat = playbackBuffers[0].format
    playbackEngine.connect(playerNode, to: playbackEngine.mainMixerNode, format: outputFormat)
  
    for buffer in playbackBuffers {
      playerNode.scheduleBuffer(buffer, completionHandler: nil)
    }
  
    do {
      try playbackEngine.start()
      playerNode.play()
    } catch {
      print("Failed to start playback engine: \(error)")
    }
  }
  */
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
