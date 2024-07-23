import AVFoundation
import Foundation
import Speech

enum RecognizerError: Error {
  case nilRecognizer
  case notAuthorizedToRecognize
  case notPermittedToRecord
  case recognizerIsUnavailable
  case invalidAudioSource

  var message: String {
    switch self {
    case .nilRecognizer:
      return "Can't initialize speech recognizer. Ensure the locale is supported by the device."
    case .notAuthorizedToRecognize: return "Not authorized to recognize speech"
    case .notPermittedToRecord: return "Not permitted to record audio"
    case .recognizerIsUnavailable: return "Recognizer is unavailable"
    case .invalidAudioSource: return "Invalid audio source"
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
  private var file: AVAudioFile?
  private var outputFileUrl: URL?

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
        speechStartHandler: speechStartHandler
      )
      // Emit the "start" event
      startHandler()
      // If user has opted in to recording, emit a "start" recording event with the path
      if let outputPath = await outputFileUrl?.path {
        audioStartHandler(outputPath)
      }
    }
  }

  @MainActor func stop(_ andEmitEnd: Bool = false) {
    Task {
      await reset(andEmitEnd: andEmitEnd)
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
    speechStartHandler: @escaping () -> Void
  ) {
    // Reset the speech recognizer before starting
    reset(andEmitEnd: false)

    self.file = nil
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

      var audioEngine: AVAudioEngine?
      if isSourcedFromFile {
        // If we're doing file-based recognition we don't need to create an audio engine
        self.audioEngine = nil
      } else {
        audioEngine = AVAudioEngine()

        // Set up the audio session to get the correct audio format
        // Todo: allow user to configure audio session category and mode
        // prior to starting speech recognition
        try Self.setupAudioSession(options.iosCategory)

        // Feature: file recording
        if options.recordingOptions?.persist == true {
          let (audio, outputUrl) = prepareFileWriter(
            outputDirectory: options.recordingOptions?.outputDirectory,
            outputFileName: options.recordingOptions?.outputFileName,
            audioEngine: audioEngine!
          )
          self.file = audio
          self.outputFileUrl = outputUrl
        }

        // Set up audio recording & sink to recognizer/file
        try Self.prepareEngine(
          audioEngine: audioEngine!,
          options: options,
          request: request,
          file: self.file
        )

        // Given no errors, it should be safe to assign this
        self.audioEngine = audioEngine
      }

      // Don't run any timers if the audio source is from a file
      let continuous = options.continuous || isSourcedFromFile

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
    } catch {
      errorHandler(error)
      reset(andEmitEnd: true)
    }
  }

  private func prepareFileWriter(
    outputDirectory: String?,
    outputFileName: String?,
    audioEngine: AVAudioEngine
  ) -> (AVAudioFile?, URL?) {
    let baseDir: URL

    if let outputDirectory = outputDirectory {
      baseDir = URL(fileURLWithPath: outputDirectory, isDirectory: true)
    } else {
      guard let dirPath = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
      else {
        print("Failed to get cache directory path.")
        return (nil, nil)
      }
      baseDir = dirPath
    }

    let fileName = outputFileName ?? "recording_\(UUID().uuidString).caf"
    let filePath = baseDir.appendingPathComponent(fileName)

    do {
      // Ensure settings are compatible with the input format
      let file = try AVAudioFile(
        forWriting: filePath,
        settings: audioEngine.inputNode.outputFormat(forBus: 0).settings
      )
      return (file, filePath)
    } catch {
      print("Failed to create AVAudioFile: \(error)")
      return (nil, nil)
    }
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

  /// Reset the speech recognizer.
  private func reset(andEmitEnd: Bool = false) {
    let taskWasRunning = task != nil

    task?.cancel()
    // End the audio buffer request (for non-file-based recognition)
    if let request = request as? SFSpeechAudioBufferRecognitionRequest {
      request.endAudio()
    }
    audioEngine?.stop()
    audioEngine?.inputNode.removeTap(onBus: 0)
    audioEngine = nil
    file = nil
    request = nil
    task = nil
    speechStartHandler = nil
    invalidateDetectionTimer()

    // If the task was running, emit the end handler
    // This avoids emitting the end handler multiple times
    // Unless we really need to emit the end event
    // (e.g. in the case of a setup error)
    print("SpeechRecognizer: end")
    if taskWasRunning || andEmitEnd {
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

  private static func prepareEngine(
    audioEngine: AVAudioEngine,
    options: SpeechRecognitionOptions,
    request: SFSpeechRecognitionRequest,
    file: AVAudioFile?
  ) throws {
    let inputNode = audioEngine.inputNode
    let recordingFormat = inputNode.outputFormat(forBus: 0)

    // Ensure the format is valid before proceeding
    guard recordingFormat.sampleRate > 0 && recordingFormat.channelCount > 0 else {
      print("ERROR: Invalid audio format: \(recordingFormat)")
      throw RecognizerError.invalidAudioSource
    }

    guard let audioBufferRequest = request as? SFSpeechAudioBufferRecognitionRequest else {
      throw RecognizerError.invalidAudioSource
    }

    inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) {
      (buffer: AVAudioPCMBuffer, when: AVAudioTime) in
      audioBufferRequest.append(buffer)
      if let file = file {
        do {
          try file.write(from: buffer)
        } catch {
          print("Failed to write buffer to file: \(error)")
        }
      }
    }

    audioEngine.prepare()
    try audioEngine.start()
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
          // TODO: check if calling self?.request.endAudio() is preferable
          // so we get final results
          await self?.reset()
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
