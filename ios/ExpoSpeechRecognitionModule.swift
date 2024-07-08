import AVFoundation
import ExpoModulesCore
import Speech

public class ExpoSpeechRecognitionModule: Module {

  var speechRecognizer: ExpoSpeechRecognizer?

  public func definition() -> ModuleDefinition {
    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
    // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
    // The module will be accessible from `requireNativeModule('ExpoSpeechRecognition')` in JavaScript.
    Name("ExpoSpeechRecognition")

    OnDestroy {
      // Stop the speech recognizer
      Task {
        await speechRecognizer?.stop()
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
      // Called when there's results (as a string array, not API compliant)
      "result",

      // Custom events

      // Called when the endpointer is ready for the user to start speaking.
      "_speechready"
    )

    /** Start recognition with args: lang, interimResults, maxAlternatives */
    Function("start") { (options: SpeechRecognitionOptions) in
      Task {
        do {
          // Stop transcribing, if necessary
          await speechRecognizer?.stop()

          let currentLocale = await speechRecognizer?.getLocale()

          // Re-create the speech recognizer when locales change
          if self.speechRecognizer == nil || currentLocale != options.lang {
            guard let locale = resolveLocale(localeIdentifier: options.lang) else {
              let availableLocales = SFSpeechRecognizer.supportedLocales().map { $0.identifier }
                .joined(separator: ", ")

              sendErrorAndStop(
                code: "language-not-supported",
                message:
                  "Locale \(options.lang) is not supported by the speech recognizer. Available locales: \(availableLocales)"
              )
              return
            }

            self.speechRecognizer = try await ExpoSpeechRecognizer(
              locale: locale
            )
          }

          // Start recognition!
          await speechRecognizer?.start(
            options: options,
            resultHandler: { [weak self] result in
              self?.handleRecognitionResult(result)
            },
            errorHandler: { [weak self] error in
              self?.handleRecognitionError(error)
            },
            endHandler: { [weak self] in
              self?.handleEnd()
            },
            speechStartHandler: { [weak self] in
              self?.sendEvent("speechstart")
            }
          )
          sendEvent("start")
        } catch {
          self.sendEvent(
            "error",
            [
              "code": "not-allowed",
              "message": error.localizedDescription,
            ]
          )
        }
      }
    }

    Function("isOnDeviceRecognitionAvailable") {
      let recognizer = SFSpeechRecognizer()
      return recognizer?.supportsOnDeviceRecognition ?? false
    }

    Function("stop") {
      Task {
        await speechRecognizer?.stop()
      }
    }

    Function("getSpeechRecognitionServices") {
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
  }

  /** Normalizes the locale for compatibility between Android and iOS */
  func resolveLocale(localeIdentifier: String) -> Locale? {
    let normalizedIdentifier = localeIdentifier.replacingOccurrences(of: "-", with: "_")
    let localesToCheck = [localeIdentifier, normalizedIdentifier]

    for identifier in localesToCheck {
      if SFSpeechRecognizer.supportedLocales().contains(where: { $0.identifier == identifier }) {
        return Locale(identifier: identifier)
      }
    }

    return nil
  }

  func sendErrorAndStop(code: String, message: String) {
    sendEvent("error", ["code": code, "message": message])
    sendEvent("end")
  }

  func handleEnd() {
    sendEvent("end")
  }

  func handleRecognitionResult(_ result: SFSpeechRecognitionResult) {
    let transcriptions = result.transcriptions.map { $0.formattedString }.filter { !$0.isEmpty }

    if transcriptions.count == 0 {
      // https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/nomatch_event
      // The nomatch event of the Web Speech API is fired
      // when the speech recognition service returns a final result with no significant recognition.
      if result.isFinal {
        sendEvent("nomatch")
      }
      return
    }

    sendEvent(
      "result",
      [
        "isFinal": result.isFinal,
        "transcriptions": transcriptions,
      ]
    )
  }

  func handleRecognitionError(_ error: Error) {
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
      ([203], "recognition-error", "Failure occurred during speech recognition."),
      ([1100], "busy", "Trying to start recognition while an earlier instance is still active."),
      ([1101, 1107], "network", "Connection to speech process was invalidated or interrupted."),
      ([1110], "no-speech", "No speech was detected."),
      ([1700], "not-allowed", "Request is not authorized."),
    ]

    for (codes, code, message) in errorTypes {
      if codes.contains(errorCode) {
        sendEvent("error", ["code": code, "message": message])
        return
      }
    }

    // Unknown error (but not a canceled request)
    if errorCode != 301 {
      sendEvent("error", ["code": "ios_\(errorCode)", "message": error.localizedDescription])
    }
  }
}
