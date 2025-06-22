# expo-speech-recognition

## 2.1.1

### Patch Changes

- dd8d0dd: Fix: restricted speech recognition permissions for iOS will now be classified as "denied" instead of "undetermined"

  You can now use `restricted` to check whether the Speech Recognition permission is restricted:

  ```ts
  const permissions =
    await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  if (!permissions.granted) {
    if (permissions.restricted) {
      // Ask user to enable speech recognition on their device, either in:
      // Settings -> Screen Time -> Content & Privacy Restrictions -> Speech Recognition
      // or Settings -> General -> VPN & Device Management
      // (if it is part of a MDM profile, see: https://support.apple.com/en-us/guide/deployment/depc0aadd3fe/web)
    } else {
      // Ask user to enable speech recognition for your app
    }
    return;
  }
  ```

## 2.1.0

### Minor Changes

- c6cb064: Added `iosVoiceProcessingEnabled` option to prevent microphone feedback from speakers for iOS

## 2.0.0

### Major Changes

- 71461d1: Added support for Expo SDK 53

## 1.1.1

### Patch Changes

- 46d8490: Add type guards to Web Speech API to avoid unresolved references

## 1.1.0

### Minor Changes

- 7fa9bc6: Implemented long form file-based transcriptions for iOS. This change circumvents the undocumented 1-minute limitation in [`SFSpeechURLRecognitionRequest
`](https://developer.apple.com/documentation/speech/sfspeechurlrecognitionrequest).

## 1.0.1

### Patch Changes

- e4c54f1: Fixed handling of interim and final results on web
- d3d3d63: Separate microphone and recognizer permissions

## 1.0.0

### Major Changes

- 8a3f597: Support for SDK 52.

### Breaking Changes:

- Removed `ExpoSpeechRecognitionModuleEmitter`. Use `ExpoSpeechRecognitionModule.addListener` instead.

## 0.2.25

### Patch Changes

- 24693ad: Initial release!
