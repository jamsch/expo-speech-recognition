import AVFoundation
import Foundation
import Speech

/// A helper for transcribing speech to text using SFSpeechRecognizer and AVAudioEngine.
actor ExpoSpeechRecognizer: ObservableObject {

  enum RecognizerError: Error {
    case nilRecognizer
    case notAuthorizedToRecognize
    case notPermittedToRecord
    case recognizerIsUnavailable

    var message: String {
      switch self {
      case .nilRecognizer: return "Can't initialize speech recognizer"
      case .notAuthorizedToRecognize: return "Not authorized to recognize speech"
      case .notPermittedToRecord: return "Not permitted to record audio"
      case .recognizerIsUnavailable: return "Recognizer is unavailable"
      }
    }
  }

  @MainActor var transcript: String = ""

  private var options: SpeechRecognitionOptions?
  private var audioEngine: AVAudioEngine?
  private var request: SFSpeechAudioBufferRecognitionRequest?
  private var task: SFSpeechRecognitionTask?
  private var recognizer: SFSpeechRecognizer?

  @MainActor var endHandler: (() -> Void)?

  /// Initializes a new speech recognizer. If this is the first time you've used the class, it
  /// requests access to the speech recognizer and the microphone.
  init(
    locale: String
  ) async throws {
    recognizer = SFSpeechRecognizer(
      locale: Locale(identifier: locale)
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
    endHandler: (() -> Void)?
  ) {
    // assign the end handler to the task
    self.endHandler = endHandler
    Task {
      await startRecognizer(
        options: options,
        resultHandler: resultHandler,
        errorHandler: errorHandler
      )
    }
  }

  @MainActor func stop() {
    Task {
      await reset()
    }
  }

  /// Begin transcribing audio.
  ///
  /// Creates a `SFSpeechRecognitionTask` that transcribes speech to text until you call `stop()`.
  private func startRecognizer(
    options: SpeechRecognitionOptions,
    resultHandler: @escaping (SFSpeechRecognitionResult) -> Void,
    errorHandler: @escaping (Error) -> Void
  ) {
    guard let recognizer: SFSpeechRecognizer, recognizer.isAvailable else {
      errorHandler(RecognizerError.recognizerIsUnavailable)
      return
    }

    do {
      let (audioEngine, request) = try Self.prepareEngine(options: options, recognizer: recognizer)
      self.audioEngine = audioEngine
      self.request = request

      self.task = recognizer.recognitionTask(
        with: request,
        resultHandler: { [weak self] result, error in
          self?.recognitionHandler(
            audioEngine: audioEngine,
            result: result,
            error: error,
            resultHandler: resultHandler,
            errorHandler: errorHandler,
            continuous: options.continuous
          )
        })
    } catch {
      self.reset()
      errorHandler(error)
    }
  }

  /// Reset the speech recognizer.
  private func reset() {
    let taskWasRunning = task != nil
    task?.cancel()
    audioEngine?.stop()
    audioEngine = nil
    request = nil
    task = nil
    // If the task was running, emit the end handler
    // This avoids emitting the end handler multiple times

    // log the end event to the console
    print("SpeechRecognizer: end")
    if taskWasRunning {
      Task {

        await MainActor.run {
          self.endHandler?()
        }
      }
    }
  }

  private static func prepareEngine(
    options: SpeechRecognitionOptions, recognizer: SFSpeechRecognizer
  ) throws -> (AVAudioEngine, SFSpeechAudioBufferRecognitionRequest) {
    let audioEngine = AVAudioEngine()

    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = options.interimResults
    if recognizer.supportsOnDeviceRecognition {
      request.requiresOnDeviceRecognition = options.requiresOnDeviceRecognition
    }
    request.contextualStrings = options.contextualStrings
    if #available(iOS 16, *) {
      request.addsPunctuation = options.addsPunctuation
    }

    let audioSession = AVAudioSession.sharedInstance()
    try audioSession.setCategory(.playAndRecord, mode: .measurement, options: .duckOthers)
    try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
    let inputNode = audioEngine.inputNode

    let recordingFormat = inputNode.outputFormat(forBus: 0)
    inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) {
      (buffer: AVAudioPCMBuffer, when: AVAudioTime) in
      request.append(buffer)
    }
    audioEngine.prepare()
    try audioEngine.start()

    return (audioEngine, request)
  }

  nonisolated private func recognitionHandler(
    audioEngine: AVAudioEngine,
    result: SFSpeechRecognitionResult?,
    error: Error?,
    resultHandler: @escaping (SFSpeechRecognitionResult) -> Void,
    errorHandler: @escaping (Error) -> Void,
    continuous: Bool
  ) {
    let receivedFinalResult = result?.isFinal ?? false
    let receivedError = error != nil

    if receivedFinalResult || receivedError {
      audioEngine.stop()
      audioEngine.inputNode.removeTap(onBus: 0)
    }

    if let result: SFSpeechRecognitionResult {
      Task { @MainActor in
        resultHandler(result)
      }
      if !continuous && receivedFinalResult {
        // Stop the speech recognizer
        Task {
          await self.reset()
        }
      }
    }

    if let error: Error {
      errorHandler(error)
      return
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
