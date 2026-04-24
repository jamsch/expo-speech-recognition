import AVFoundation
import React
import Speech

struct Segment {
  let startTimeMillis: Double
  let endTimeMillis: Double
  let segment: String
  let confidence: Float

  func toDictionary() -> [String: Any] {
    [
      "startTimeMillis": startTimeMillis,
      "endTimeMillis": endTimeMillis,
      "segment": segment,
      "confidence": confidence,
    ]
  }
}

struct TranscriptionResult {
  let transcript: String
  let confidence: Float
  let segments: [Segment]

  func toDictionary() -> [String: Any] {
    [
      "transcript": transcript,
      "confidence": confidence,
      "segments": segments.map { $0.toDictionary() },
    ]
  }
}

private enum IOSPermissionStatus: String {
  case undetermined
  case denied
  case granted
}

@objc(ExpoSpeechRecognition)
final class ExpoSpeechRecognition: RCTEventEmitter {
  private var speechRecognizer: ExpoSpeechRecognizer?
  private var hasListeners = false

  // Hack for iOS 18 to detect final results
  // See: https://forums.developer.apple.com/forums/thread/762952 for more info
  private var hasSeenFinalResult = false

  // Hack for iOS 18 to avoid sending a "nomatch" event after the final-final result
  private var previousResult: SFSpeechRecognitionResult?

  @objc
  override static func requiresMainQueueSetup() -> Bool {
    true
  }

  override func supportedEvents() -> [String]! {
    [
      "audiostart",
      "audioend",
      "end",
      "error",
      "nomatch",
      "result",
      "soundstart",
      "soundend",
      "speechstart",
      "speechend",
      "start",
      "languagedetection",
      "volumechange",
    ]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  deinit {
    Task {
      await speechRecognizer?.abort()
    }
  }

  @objc(start:)
  func start(options: NSDictionary) {
    let parsedOptions = SpeechRecognitionOptions(
      dictionary: options as? [String: Any] ?? [:]
    )

    Task {
      do {
        let currentLocale = await speechRecognizer?.getLocale()
        previousResult = nil

        if speechRecognizer == nil || currentLocale != parsedOptions.lang {
          guard let locale = resolveLocale(localeIdentifier: parsedOptions.lang) else {
            let availableLocales = SFSpeechRecognizer.supportedLocales().map(\.identifier)
              .joined(separator: ", ")

            sendErrorAndStop(
              error: "language-not-supported",
              message:
                "Locale \(parsedOptions.lang) is not supported by the speech recognizer. Available locales: \(availableLocales)"
            )
            return
          }

          speechRecognizer = try await ExpoSpeechRecognizer(locale: locale)
        }

        if !parsedOptions.requiresOnDeviceRecognition {
          let speechPermission = await getSpeechPermissionResponse()
          guard speechPermission["granted"] as? Bool == true else {
            sendErrorAndStop(
              error: "not-allowed",
              message: RecognizerError.notAuthorizedToRecognize.message
            )
            return
          }
        }

        let microphonePermission = await getMicrophonePermissionResponse()
        guard microphonePermission["granted"] as? Bool == true else {
          sendErrorAndStop(
            error: "not-allowed",
            message: RecognizerError.notPermittedToRecord.message
          )
          return
        }

        await speechRecognizer?.start(
          options: parsedOptions,
          resultHandler: { [weak self] result in
            self?.handleRecognitionResult(result, maxAlternatives: parsedOptions.maxAlternatives)
          },
          errorHandler: { [weak self] error in
            self?.handleRecognitionError(error)
          },
          endHandler: { [weak self] in
            self?.handleEnd()
          },
          startHandler: { [weak self] in
            self?.emitEvent(name: "start")
          },
          speechStartHandler: { [weak self] in
            self?.emitEvent(name: "speechstart")
          },
          audioStartHandler: { [weak self] filePath in
            self?.emitEvent(name: "audiostart", body: ["uri": self?.normalizeUri(filePath)])
          },
          audioEndHandler: { [weak self] filePath in
            self?.emitEvent(name: "audioend", body: ["uri": self?.normalizeUri(filePath)])
          },
          volumeChangeHandler: { [weak self] value in
            self?.emitEvent(name: "volumechange", body: ["value": value])
          }
        )
      } catch {
        emitEvent(
          name: "error",
          body: [
            "error": "not-allowed",
            "message": error.localizedDescription,
          ]
        )
      }
    }
  }

  @objc
  func stop() {
    Task {
      if let recognizer = speechRecognizer {
        await recognizer.stop()
      } else {
        emitEvent(name: "end")
      }
    }
  }

  @objc
  func abort() {
    Task {
      emitEvent(
        name: "error",
        body: ["error": "aborted", "message": "Speech recognition aborted."]
      )

      if let recognizer = speechRecognizer {
        await recognizer.abort()
      } else {
        emitEvent(name: "end")
      }
    }
  }

  @objc(requestPermissionsAsync:rejecter:)
  func requestPermissionsAsync(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task {
      let microphoneStatus = await requestMicrophonePermission()
      let speechStatus = await requestSpeechPermission()
      resolve(combinePermissionResponses(microphone: microphoneStatus, speech: speechStatus))
    }
  }

  @objc(getPermissionsAsync:rejecter:)
  func getPermissionsAsync(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task {
      let microphoneStatus = await getMicrophonePermissionResponse()
      let speechStatus = await getSpeechPermissionResponse()
      resolve(combinePermissionResponses(microphone: microphoneStatus, speech: speechStatus))
    }
  }

  @objc(addListener:)
  override func addListener(_ eventName: String!) {
    super.addListener(eventName)
  }

  @objc(removeListeners:)
  override func removeListeners(_ count: Double) {
    super.removeListeners(count)
  }

  private func normalizeUri(_ filePath: String?) -> String? {
    guard let filePath else {
      return nil
    }

    return filePath.hasPrefix("file://") ? filePath : "file://" + filePath
  }

  private func emitEvent(name: String, body: Any? = nil) {
    guard hasListeners else {
      return
    }

    sendEvent(withName: name, body: body)
  }

  private func resolveLocale(localeIdentifier: String) -> Locale? {
    let normalizedIdentifier = localeIdentifier.replacingOccurrences(of: "_", with: "-")
    let localesToCheck = [localeIdentifier, normalizedIdentifier]
    let supportedLocales = SFSpeechRecognizer.supportedLocales()

    for identifier in localesToCheck {
      if supportedLocales.contains(where: { $0.identifier == identifier }) {
        return Locale(identifier: identifier)
      }
    }

    return nil
  }

  private func sendErrorAndStop(error: String, message: String) {
    hasSeenFinalResult = false
    previousResult = nil
    emitEvent(name: "error", body: ["error": error, "message": message])
    emitEvent(name: "end")
  }

  private func handleEnd() {
    hasSeenFinalResult = false
    previousResult = nil
    emitEvent(name: "end")
  }

  private func handleRecognitionResult(_ result: SFSpeechRecognitionResult, maxAlternatives: Int) {
    var results: [TranscriptionResult] = []
    let transcriptionSubsequence = result.transcriptions.prefix(maxAlternatives)
    var isFinal = result.isFinal

    if #available(iOS 18.0, *), !isFinal {
      isFinal = result.speechRecognitionMetadata?.speechDuration ?? 0 > 0
    }

    for transcription in transcriptionSubsequence {
      var transcript = transcription.formattedString

      if hasSeenFinalResult {
        transcript = " " + transcription.formattedString
      }

      let segments = transcription.segments.map { segment in
        Segment(
          startTimeMillis: segment.timestamp * 1000,
          endTimeMillis: (segment.timestamp * 1000) + segment.duration * 1000,
          segment: segment.substring,
          confidence: segment.confidence
        )
      }

      let confidence =
        transcription.segments.map(\.confidence).reduce(0, +)
        / Float(max(transcription.segments.count, 1))

      let item = TranscriptionResult(
        transcript: transcript,
        confidence: confidence,
        segments: segments
      )

      if !transcription.formattedString.isEmpty {
        results.append(item)
      }
    }

    if #available(iOS 18.0, *), !result.isFinal, isFinal {
      hasSeenFinalResult = true
    }

    if isFinal && results.isEmpty {
      var previousResultWasFinal = false
      var previousResultHadTranscriptions = false
      if #available(iOS 18.0, *), let previousResult {
        previousResultWasFinal = previousResult.speechRecognitionMetadata?.speechDuration ?? 0 > 0
        previousResultHadTranscriptions = !previousResult.transcriptions.isEmpty
      }

      if !previousResultWasFinal || !previousResultHadTranscriptions {
        emitEvent(name: "nomatch")
        return
      }
    }

    emitEvent(
      name: "result",
      body: [
        "isFinal": isFinal,
        "results": results.map { $0.toDictionary() },
      ]
    )

    previousResult = result
  }

  private func handleRecognitionError(_ error: Error) {
    let expoSpeechError = error as? ExpoSpeechRecognitionException
    let code = expoSpeechError?.code ?? "unknown"
    let message = expoSpeechError?.reason ?? error.localizedDescription

    emitEvent(
      name: "error",
      body: [
        "error": code,
        "message": message,
      ]
    )
  }

  private func requestMicrophonePermission() async -> [String: Any] {
    let granted = await withCheckedContinuation { continuation in
      AVAudioSession.sharedInstance().requestRecordPermission { isGranted in
        continuation.resume(returning: isGranted)
      }
    }

    return await getMicrophonePermissionResponse(grantedOverride: granted)
  }

  private func requestSpeechPermission() async -> [String: Any] {
    let status = await withCheckedContinuation { continuation in
      SFSpeechRecognizer.requestAuthorization { authorizationStatus in
        continuation.resume(returning: authorizationStatus)
      }
    }

    return speechPermissionResponse(from: status)
  }

  private func getMicrophonePermissionResponse(grantedOverride: Bool? = nil) async -> [String: Any] {
    let granted: Bool
    let status: IOSPermissionStatus

    if let grantedOverride {
      granted = grantedOverride
      status = grantedOverride ? .granted : .denied
    } else if #available(iOS 17.0, *) {
      switch AVAudioApplication.shared.recordPermission {
      case .granted:
        granted = true
        status = .granted
      case .denied:
        granted = false
        status = .denied
      case .undetermined:
        granted = false
        status = .undetermined
      @unknown default:
        granted = false
        status = .undetermined
      }
    } else {
      switch AVAudioSession.sharedInstance().recordPermission {
      case .granted:
        granted = true
        status = .granted
      case .denied:
        granted = false
        status = .denied
      case .undetermined:
        granted = false
        status = .undetermined
      @unknown default:
        granted = false
        status = .undetermined
      }
    }

    return permissionResponse(
      status: status,
      granted: granted,
      canAskAgain: status == .undetermined
    )
  }

  private func getSpeechPermissionResponse() async -> [String: Any] {
    speechPermissionResponse(from: SFSpeechRecognizer.authorizationStatus())
  }

  private func speechPermissionResponse(from status: SFSpeechRecognizerAuthorizationStatus) -> [String: Any] {
    switch status {
    case .authorized:
      return permissionResponse(status: .granted, granted: true, canAskAgain: false)
    case .denied:
      return permissionResponse(status: .denied, granted: false, canAskAgain: false)
    case .restricted:
      return permissionResponse(
        status: .denied,
        granted: false,
        canAskAgain: false,
        restricted: true
      )
    case .notDetermined:
      return permissionResponse(status: .undetermined, granted: false, canAskAgain: true)
    @unknown default:
      return permissionResponse(status: .undetermined, granted: false, canAskAgain: true)
    }
  }

  private func combinePermissionResponses(
    microphone: [String: Any],
    speech: [String: Any]
  ) -> [String: Any] {
    let microphoneGranted = microphone["granted"] as? Bool ?? false
    let speechGranted = speech["granted"] as? Bool ?? false
    let microphoneStatus = microphone["status"] as? String ?? IOSPermissionStatus.undetermined.rawValue
    let speechStatus = speech["status"] as? String ?? IOSPermissionStatus.undetermined.rawValue
    let restricted = speech["restricted"] as? Bool ?? false

    let combinedStatus: IOSPermissionStatus
    if microphoneGranted && speechGranted {
      combinedStatus = .granted
    } else if microphoneStatus == IOSPermissionStatus.denied.rawValue
      || speechStatus == IOSPermissionStatus.denied.rawValue
    {
      combinedStatus = .denied
    } else {
      combinedStatus = .undetermined
    }

    // 这里合并麦克风和语音识别两个权限结果，确保 JS 层只拿到一个可直接判定是否可启动识别的响应。
    return permissionResponse(
      status: combinedStatus,
      granted: microphoneGranted && speechGranted,
      canAskAgain:
        (microphone["canAskAgain"] as? Bool ?? false)
        || (speech["canAskAgain"] as? Bool ?? false),
      restricted: restricted
    )
  }

  private func permissionResponse(
    status: IOSPermissionStatus,
    granted: Bool,
    canAskAgain: Bool,
    restricted: Bool = false
  ) -> [String: Any] {
    var response: [String: Any] = [
      "status": status.rawValue,
      "granted": granted,
      "canAskAgain": canAskAgain,
      "expires": "never",
    ]

    if restricted {
      response["restricted"] = true
    }

    return response
  }
}
