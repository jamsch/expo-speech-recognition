import ExpoModulesCore

/*
no-speech
No speech was detected.

aborted
Speech input was aborted in some manner, perhaps by some user-agent-specific behavior like a button the user can press to cancel speech input.

audio-capture
Audio capture failed.

network
Network communication required for completing the recognition failed.

not-allowed
The user agent disallowed any speech input from occurring for reasons of security, privacy or user preference.

service-not-allowed
The user agent disallowed the requested speech recognition service, either because the user agent doesn't support it or because of reasons of security, privacy or user preference. In this case it would allow another more suitable speech recognition service to be used instead.

bad-grammar
There was an error in the speech recognition grammar or semantic tags, or the chosen grammar format or semantic tag format was unsupported.

language-not-supported
The user agent does not support the language specified in the value of lang attribute of the SpeechRecognition object. The set of supported languages is browser-dependent, and from frontend code there is no way to programmatically determine what languages a user's browser supports for speech recognition.
*/

internal final class NilRecognizerException: Exception {
  override var code: String {
    "audio-capture"
  }

  override var reason: String {
    "Can't initialize speech recognizer"
  }
}

internal final class PermissionException: Exception {
  override var code: String {
    "not-allowed"
  }
  override var reason: String {
    "Speech recognition permissions have not been granted"
  }
}

internal final class NotAuthorizedException: Exception {
  override var code: String {
    "not-allowed"
  }

  override var reason: String {
    "Not authorized to recognize speech"
  }
}

internal final class NotPermittedToRecordException: Exception {
  override var code: String {
    "not-allowed"
  }
  override var reason: String {
    "Recording permission has not been granted"
  }
}

internal final class InvalidAudioModeException: GenericException<String> {
  override var code: String {
    "audio-capture"
  }
  override var reason: String {
    "Impossible audio mode: \(param)"
  }
}

internal final class RecognizerUnavilableException: Exception {
  override var code: String {
    "service-not-allowed"
  }

  override var reason: String {
    "Recognizer is unavailable"
  }
}
