import AVFoundation
import ExpoModulesCore
import Speech

struct Segment {
  let startTimeMillis: Double
  let endTimeMillis: Double
  let segment: String
  let confidence: Float

  func toDictionary() -> [String: Any] {
    return [
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
    return [
      "transcript": transcript,
      "confidence": confidence,
      "segments": segments.map { $0.toDictionary() },
    ]
  }
}

public class ExpoSpeechRecognitionModule: Module {

  var speechRecognizer: ExpoSpeechRecognizer?

  // Hack for iOS 18 to detect final results
  // See: https://forums.developer.apple.com/forums/thread/762952 for more info
  // This is a temporary workaround until the issue is fixed in a future iOS release
  var hasSeenFinalResult: Bool = false

  // Hack for iOS 18 to avoid sending a "nomatch" event after the final-final result
  // Example event order emitted in iOS 18:
  // [
  //   { isFinal: false, transcripts: ["actually", "final", "results"], metadata: { duration: 1500 } },
  //   { isFinal: true, transcripts: [] }
  // ]
  var previousResult: SFSpeechRecognitionResult?

  public func definition() -> ModuleDefinition {
    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
    // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
    // The module will be accessible from `requireNativeModule('ExpoSpeechRecognition')` in JavaScript.
    Name("ExpoSpeechRecognition")

    OnDestroy {
      // Cancel any running speech recognizers
      Task {
        await speechRecognizer?.abort()
      }
    }

    // Defines event names that the module can send to JavaScript.
    Events(
      // Fired when the user agent has started to capture audio.
      "audiostart",
      // Fired when the user agent has finished capturing audio.
      "audioend",
      // Fired when the speech recognition service has disconnected.
      "end",
      // Fired when a speech recognition error occurs.
      "error",
      // Fired when the speech recognition service returns a final result with no significant
      // recognition. This may involve some degree of recognition, which doesn't meet or
      // exceed the confidence threshold.
      "nomatch",
      // Fired when the speech recognition service returns a result — a word or phrase has been
      // positively recognized and this has been communicated back to the app.
      "result",
      // Fired when any sound — recognizable speech or not — has been detected.
      "soundstart",
      // Fired when any sound — recognizable speech or not — has stopped being detected.
      "soundend",
      // Fired when sound that is recognized by the speech recognition service as speech
      // has been detected.
      "speechstart",
      // Fired when speech recognized by the speech recognition service has stopped being
      // detected.
      "speechend",
      // Fired when the speech recognition service has begun listening to incoming audio with
      // intent to recognize grammars associated with the current SpeechRecognition
      "start",
      // Called when the language detection (and switching) results are available.
      "languagedetection",
      // Fired when the input volume changes
      "volumechange"
    )

    OnCreate {
      guard let permissionsManager = appContext?.permissions else {
        return
      }
      permissionsManager.register([
        EXSpeechRecognitionPermissionRequester(),
        MicrophoneRequester(),
        SpeechRecognizerRequester(),
      ])
    }

    AsyncFunction("requestPermissionsAsync") { (promise: Promise) in
      guard let permissions = appContext?.permissions else {
        throw Exceptions.PermissionsModuleNotFound()
      }
      permissions.askForPermission(
        usingRequesterClass: EXSpeechRecognitionPermissionRequester.self,
        resolve: promise.resolver,
        reject: promise.legacyRejecter
      )
    }

    AsyncFunction("getPermissionsAsync") { (promise: Promise) in
      guard let permissions = self.appContext?.permissions else {
        throw Exceptions.PermissionsModuleNotFound()
      }
      permissions.getPermissionUsingRequesterClass(
        EXSpeechRecognitionPermissionRequester.self,
        resolve: promise.resolver,
        reject: promise.legacyRejecter
      )
    }

    AsyncFunction("getMicrophonePermissionsAsync") { (promise: Promise) in
      appContext?.permissions?.getPermissionUsingRequesterClass(
        MicrophoneRequester.self,
        resolve: promise.resolver,
        reject: promise.legacyRejecter
      )
    }

    AsyncFunction("requestMicrophonePermissionsAsync") { (promise: Promise) in
      appContext?.permissions?.askForPermission(
        usingRequesterClass: MicrophoneRequester.self,
        resolve: promise.resolver,
        reject: promise.legacyRejecter
      )
    }

    AsyncFunction("getSpeechRecognizerPermissionsAsync") { (promise: Promise) in
      appContext?.permissions?.getPermissionUsingRequesterClass(
        SpeechRecognizerRequester.self,
        resolve: promise.resolver,
        reject: promise.legacyRejecter
      )
    }

    AsyncFunction("requestSpeechRecognizerPermissionsAsync") { (promise: Promise) in
      appContext?.permissions?.askForPermission(
        usingRequesterClass: SpeechRecognizerRequester.self,
        resolve: promise.resolver,
        reject: promise.legacyRejecter
      )
    }

    AsyncFunction("getStateAsync") { (promise: Promise) in
      Task {
        let state = await speechRecognizer?.getState()
        promise.resolve(state ?? "inactive")
      }
    }

    /** Start recognition with args: lang, interimResults, maxAlternatives */
    Function("start") { (options: SpeechRecognitionOptions) in
      Task {
        do {
          let currentLocale = await speechRecognizer?.getLocale()

          // Reset the previous result
          self.previousResult = nil

          // Re-create the speech recognizer when locales change
          if self.speechRecognizer == nil || currentLocale != options.lang {
            guard let locale = resolveLocale(localeIdentifier: options.lang) else {
              let availableLocales = SFSpeechRecognizer.supportedLocales().map { $0.identifier }
                .joined(separator: ", ")

              sendErrorAndStop(
                error: "language-not-supported",
                message:
                  "Locale \(options.lang) is not supported by the speech recognizer. Available locales: \(availableLocales)"
              )
              return
            }

            self.speechRecognizer = try await ExpoSpeechRecognizer(
              locale: locale
            )
          }

          if !options.requiresOnDeviceRecognition {
            guard await SFSpeechRecognizer.hasAuthorizationToRecognize() else {
              sendErrorAndStop(
                error: "not-allowed",
                message: RecognizerError.notAuthorizedToRecognize.message
              )
              return
            }
          }

          guard await AVAudioSession.sharedInstance().hasPermissionToRecord() else {
            sendErrorAndStop(
              error: "not-allowed",
              message: RecognizerError.notPermittedToRecord.message
            )
            return
          }

          // Start recognition!
          await speechRecognizer?.start(
            options: options,
            resultHandler: { [weak self] result in
              self?.handleRecognitionResult(result, maxAlternatives: options.maxAlternatives)
            },
            errorHandler: { [weak self] error in
              self?.handleRecognitionError(error)
            },
            endHandler: { [weak self] in
              self?.handleEnd()
            },
            startHandler: { [weak self] in
              self?.sendEvent("start")
            },
            speechStartHandler: { [weak self] in
              self?.sendEvent("speechstart")
            },
            audioStartHandler: { [weak self] filePath in
              if let filePath: String {
                let uri = filePath.hasPrefix("file://") ? filePath : "file://" + filePath
                self?.sendEvent("audiostart", ["uri": uri])
              } else {
                self?.sendEvent("audiostart", ["uri": nil])
              }
            },
            audioEndHandler: { [weak self] filePath in
              if let filePath: String {
                let uri = filePath.hasPrefix("file://") ? filePath : "file://" + filePath
                self?.sendEvent("audioend", ["uri": uri])
              } else {
                self?.sendEvent("audioend", ["uri": nil])
              }
            },
            volumeChangeHandler: { [weak self] value in
              self?.sendEvent("volumechange", ["value": value])
            }
          )
        } catch {
          self.sendEvent(
            "error",
            [
              "error": "not-allowed",
              "message": error.localizedDescription,
            ]
          )
        }
      }
    }

    Function("setCategoryIOS") { (options: SetCategoryOptions) in
      // Convert the array of category options to a bitmask
      let categoryOptions = options.categoryOptions.reduce(AVAudioSession.CategoryOptions()) {
        result, option in
        result.union(option.avCategoryOption)
      }

      try AVAudioSession.sharedInstance().setCategory(
        options.category.avCategory,
        mode: options.mode.avMode,
        options: categoryOptions
      )
    }

    Function("getAudioSessionCategoryAndOptionsIOS") { () -> [String: Any] in
      let instance = AVAudioSession.sharedInstance()

      let categoryOptions: AVAudioSession.CategoryOptions = instance.categoryOptions

      var allCategoryOptions: [(option: AVAudioSession.CategoryOptions, string: String)] = [
        (.mixWithOthers, "mixWithOthers"),
        (.duckOthers, "duckOthers"),
        (.allowBluetooth, "allowBluetooth"),
        (.defaultToSpeaker, "defaultToSpeaker"),
        (.interruptSpokenAudioAndMixWithOthers, "interruptSpokenAudioAndMixWithOthers"),
        (.allowBluetoothA2DP, "allowBluetoothA2DP"),
        (.allowAirPlay, "allowAirPlay"),
      ]

      // Define a mapping from CategoryOptions to their string representations
      if #available(iOS 14.5, *) {
        allCategoryOptions.append(
          (.overrideMutedMicrophoneInterruption, "overrideMutedMicrophoneInterruption"))
      }

      // Filter and map the options that are set
      let categoryOptionsStrings =
        allCategoryOptions
        .filter { categoryOptions.contains($0.option) }
        .map { $0.string }

      let categoryMapping: [AVAudioSession.Category: String] = [
        .ambient: "ambient",
        .playback: "playback",
        .record: "record",
        .playAndRecord: "playAndRecord",
        .multiRoute: "multiRoute",
        .soloAmbient: "soloAmbient",
      ]

      let modeMapping: [AVAudioSession.Mode: String] = [
        .default: "default",
        .gameChat: "gameChat",
        .measurement: "measurement",
        .moviePlayback: "moviePlayback",
        .spokenAudio: "spokenAudio",
        .videoChat: "videoChat",
        .videoRecording: "videoRecording",
        .voiceChat: "voiceChat",
        .voicePrompt: "voicePrompt",
      ]

      return [
        "category": categoryMapping[instance.category] ?? instance.category.rawValue,
        "categoryOptions": categoryOptionsStrings,
        "mode": modeMapping[instance.mode] ?? instance.mode.rawValue,
      ]
    }

    Function("setAudioSessionActiveIOS") {
      (value: Bool, options: SetAudioSessionActiveOptions?) throws in
      let setActiveOptions: AVAudioSession.SetActiveOptions =
        options?.notifyOthersOnDeactivation == true ? .notifyOthersOnDeactivation : []

      try AVAudioSession.sharedInstance().setActive(value, options: setActiveOptions)
    }

    Function("supportsOnDeviceRecognition") { () -> Bool in
      let recognizer = SFSpeechRecognizer()
      return recognizer?.supportsOnDeviceRecognition ?? false
    }

    Function("supportsRecording") { () -> Bool in
      return true
    }

    Function("isRecognitionAvailable") { () -> Bool in
      let recognizer = SFSpeechRecognizer()
      return recognizer?.isAvailable ?? false
    }

    Function("stop") { () -> Void in
      Task {
        if let recognizer = speechRecognizer {
          await recognizer.stop()
        } else {
          sendEvent("end")
        }
      }
    }

    Function("abort") { () -> Void in
      Task {
        sendEvent("error", ["error": "aborted", "message": "Speech recognition aborted."])

        if let recognizer = speechRecognizer {
          await recognizer.abort()
        } else {
          sendEvent("end")
        }
      }
    }

    Function("getSpeechRecognitionServices") { () -> [String] in
      // Return an empty array on iOS
      return []
    }

    AsyncFunction("getSupportedLocales") { (options: GetSupportedLocaleOptions, promise: Promise) in
      let supportedLocales = SFSpeechRecognizer.supportedLocales().map { $0.identifier }.sorted()
      let installedLocales = supportedLocales

      // Return as an object
      promise.resolve([
        "locales": supportedLocales,
        // On iOS, the installed locales are the same as the supported locales
        "installedLocales": installedLocales,
      ])
    }

    Function("getDefaultRecognitionService") { () -> [String: Any] in
      return [
        "packageName": ""
      ]
    }

    Function("getAssistantService") { () -> [String: Any] in
      return [
        "packageName": ""
      ]
    }
  }

  /** Normalizes the locale for compatibility between Android and iOS */
  func resolveLocale(localeIdentifier: String) -> Locale? {
    // The supportedLocales() method returns the locales in the format with dashes, e.g. "en-US"
    // However, we shouldn't mind if the user passes in the locale with underscores, e.g. "en_US"
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

  func sendErrorAndStop(error: String, message: String) {
    hasSeenFinalResult = false
    previousResult = nil
    sendEvent("error", ["error": error, "message": message])
    sendEvent("end")
  }

  func handleEnd() {
    hasSeenFinalResult = false
    previousResult = nil
    sendEvent("end")
  }

  func handleRecognitionResult(_ result: SFSpeechRecognitionResult, maxAlternatives: Int) {
    var results: [TranscriptionResult] = []

    // Limit the number of transcriptions to the maxAlternatives
    let transcriptionSubsequence = result.transcriptions.prefix(maxAlternatives)

    var isFinal = result.isFinal

    // Hack for iOS 18 to detect final results
    // See: https://forums.developer.apple.com/forums/thread/762952 for more info
    // This is a temporary workaround until the issue is fixed in a future iOS release
    if #available(iOS 18.0, *), !isFinal {
      isFinal = result.speechRecognitionMetadata?.speechDuration ?? 0 > 0
    }

    for transcription in transcriptionSubsequence {
      var transcript = transcription.formattedString

      // Prepend an empty space if the hacky workaround is applied
      // So that the user can append the transcript to the previous result,
      // matching the behavior of Android & Web Speech API
      if hasSeenFinalResult {
        transcript = " " + transcription.formattedString
      }

      let segments = transcription.segments.map { segment in
        return Segment(
          startTimeMillis: segment.timestamp * 1000,
          endTimeMillis: (segment.timestamp * 1000) + segment.duration * 1000,
          segment: segment.substring,
          confidence: segment.confidence
        )
      }

      let confidence =
        transcription.segments.map { $0.confidence }.reduce(0, +)
        / Float(transcription.segments.count)

      let item = TranscriptionResult(
        transcript: transcript,
        confidence: confidence,
        segments: segments
      )

      if !transcription.formattedString.isEmpty {
        results.append(item)
      }
    }

    // Apply the "workaround"
    if #available(iOS 18.0, *), !result.isFinal, isFinal {
      hasSeenFinalResult = true
    }

    if isFinal && results.isEmpty {
      // Hack for iOS 18 to avoid sending a "nomatch" event after the final-final result
      var previousResultWasFinal = false
      var previousResultHadTranscriptions = false
      if #available(iOS 18.0, *), let previousResult = previousResult {
        previousResultWasFinal = previousResult.speechRecognitionMetadata?.speechDuration ?? 0 > 0
        previousResultHadTranscriptions = !previousResult.transcriptions.isEmpty
      }

      if !previousResultWasFinal || !previousResultHadTranscriptions {
        // https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/nomatch_event
        // The nomatch event of the Web Speech API is fired
        // when the speech recognition service returns a final result with no significant recognition.
        sendEvent("nomatch")
        return
      }
    }

    sendEvent(
      "result",
      [
        "isFinal": isFinal,
        "results": results.map { $0.toDictionary() },
      ]
    )

    previousResult = result
  }

  func handleRecognitionError(_ error: Error) {
    if let recognitionError = error as? RecognizerError {
      switch recognitionError {
      case .nilRecognizer:
        sendEvent(
          "error", ["error": "language-not-supported", "message": recognitionError.message])
      case .notAuthorizedToRecognize:
        sendEvent("error", ["error": "not-allowed", "message": recognitionError.message])
      case .notPermittedToRecord:
        sendEvent("error", ["error": "not-allowed", "message": recognitionError.message])
      case .recognizerIsUnavailable:
        sendEvent("error", ["error": "service-not-allowed", "message": recognitionError.message])
      case .invalidAudioSource:
        sendEvent("error", ["error": "audio-capture", "message": recognitionError.message])
      case .audioInputBusy:
        sendEvent("error", ["error": "audio-capture", "message": recognitionError.message])
      }
      return
    }

    // Other errors thrown by SFSpeechRecognizer / SFSpeechRecognitionTask

    /*
     Error Code | Error Domain | Description
     102 | kLSRErrorDomain | Assets are not installed.
     201 | kLSRErrorDomain | Siri or Dictation is disabled.
     300 | kLSRErrorDomain | Failed to initialize recognizer.
     301 | kLSRErrorDomain | Request was canceled.
     203 | kAFAssistantErrorDomain | Failure occurred during speech recognition.
     1100 | kAFAssistantErrorDomain | Trying to start recognition while an earlier instance is still active.
     1101 | kAFAssistantErrorDomain | Connection to speech process was invalidated.
     1107 | kAFAssistantErrorDomain | Connection to speech process was interrupted.
     1110 | kAFAssistantErrorDomain | Failed to recognize any speech.
     1700 | kAFAssistantErrorDomain | Request is not authorized.
     */
    let nsError = error as NSError
    let errorCode = nsError.code

    let errorTypes: [(codes: [Int], code: String, message: String)] = [
      (
        [102, 201], "service-not-allowed",
        "Assets are not installed, Siri or Dictation is disabled."
      ),
      ([203], "audio-capture", "Failure occurred during speech recognition."),
      ([1100], "busy", "Trying to start recognition while an earlier instance is still active."),
      ([1101, 1107], "network", "Connection to speech process was invalidated or interrupted."),
      ([1110], "no-speech", "No speech was detected."),
      ([1700], "not-allowed", "Request is not authorized."),
    ]

    for (codes, code, message) in errorTypes {
      if codes.contains(errorCode) {
        // Handle nomatch error for the underlying error:
        // +[AFAggregator logDictationFailedWithErrr:] Error Domain=kAFAssistantErrorDomain Code=203 "Retry" UserInfo={NSLocalizedDescription=Retry, NSUnderlyingError=0x600000d0ca50 {Error Domain=SiriSpeechErrorDomain Code=1 "(null)"}}
        if let underlyingError = nsError.userInfo[NSUnderlyingErrorKey] as? NSError {
          if errorCode == 203 && underlyingError.domain == "SiriSpeechErrorDomain"
            && underlyingError.code == 1
          {
            sendEvent("nomatch")
          } else {
            sendEvent("error", ["error": code, "message": message])
          }
        } else {
          sendEvent("error", ["error": code, "message": message])
        }
        return
      }
    }

    // Unknown error (but not a canceled request)
    if errorCode != 301 {
      sendEvent("error", ["error": "audio-capture", "message": error.localizedDescription])
    }
  }
}
