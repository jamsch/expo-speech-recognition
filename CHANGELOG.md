# expo-speech-recognition

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
