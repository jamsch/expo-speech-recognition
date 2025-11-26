# expo-speech-recognition

## 3.0.1

### Patch Changes

- 7a64d6e: (iOS) Allow passing through folder URIs for audio persistence.

  You can now do the following on Android and iOS:

  ```ts
  import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
  import { Directory, Paths } from "expo-file-system";

  const outputDirectory = new Directory(Paths.join(Paths.cache, "recordings"));

  // Create the folder, if it doesn't exist yet (Android does not yet create intermediates)
  outputDirectory.create({ intermediates: true, idempotent: true });

  // Start speech recognition with a custom directory
  ExpoSpeechRecognitionModule.start({
    lang: "en-US",
    recordingOptions: {
      persist: true,
      // e.g. "file:///data/user/0/com.yourapp.app/cache/recordings/"
      outputDirectory: outputDirectory.uri,
    },
  });
  ```

## 3.0.0

### Major Changes

- 3b48113: With this major version change, we've removed some top-level exports from the base `expo-speech-recognition` library.
  Instead you'll now need to call the function directly from `ExpoSpeechRecognitionModule`. This was changed to address
  issues with regards to symbol bindings.

  The list of removed exports:

  ```ts
  // Removed
  import { getSupportedLocales } from "expo-speech-recognition";
  // Instead use:
  ExpoSpeechRecognitionModule.getSupportedLocales();
  ```

  ```ts
  // Removed
  import { getSpeechRecognitionServices } from "expo-speech-recognition";
  // Instead use:
  ExpoSpeechRecognitionModule.getSpeechRecognitionServices();
  ```

  ```ts
  // Removed
  import { supportsOnDeviceRecognition } from "expo-speech-recognition";
  // Instead use:
  ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
  ```

  ```ts
  // Removed
  import { supportsRecording } from "expo-speech-recognition";
  // Instead use:
  ExpoSpeechRecognitionModule.supportsRecording();
  ```

  ```ts
  // Removed
  import { setCategoryIOS } from "expo-speech-recognition";
  // Instead use:
  ExpoSpeechRecognitionModule.setCategoryIOS({ ... });
  ```

  ```ts
  // Removed
  import { getAudioSessionCategoryAndOptionsIOS } from "expo-speech-recognition";
  // Instead use:
  ExpoSpeechRecognitionModule.getAudioSessionCategoryAndOptionsIOS();
  ```

  ```ts
  // Removed
  import { setAudioSessionActiveIOS } from "expo-speech-recognition";
  // Instead use:
  ExpoSpeechRecognitionModule.setAudioSessionActiveIOS(true, { ... });
  ```

  ```ts
  // Removed
  import { androidTriggerOfflineModelDownload } from "expo-speech-recognition";
  // Instead use:
  ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ ... });
  ```

  ```ts
  // Removed
  import { isRecognitionAvailable } from "expo-speech-recognition";
  // Instead use:
  ExpoSpeechRecognitionModule.isRecognitionAvailable();
  ```

  ```ts
  // Removed
  import { getDefaultRecognitionService } from "expo-speech-recognition";
  // Instead use:
  ExpoSpeechRecognitionModule.getDefaultRecognitionService();
  ```

  ```ts
  // Removed
  import { getAssistantService } from "expo-speech-recognition";
  // Instead use:
  ExpoSpeechRecognitionModule.getAssistantService();
  ```

  ```ts
  // Removed
  import { addSpeechRecognitionListener } from "expo-speech-recognition";
  // Instead use:
  ExpoSpeechRecognitionModule.addListener("foo", (event) => { ... });
  ```

## 2.1.5

### Patch Changes

- 9010d14: Android: Use `VOICE_RECOGNITION` audio source input by default and harden the record loop to gracefully handle read errors

## 2.1.4

### Patch Changes

- a3aef4e: Add native event error codes for Android.

  For advanced use cases where you'd like to debug the platform's underlying speech recognizer you can now access `event.code` from the error event. For Android, you can import the `SpeechRecognizerErrorAndroid` enum to match against this code.

  Error codes with the value of `-1` are thrown by this library and not by the `SpeechRecognizer`.

  Example use case: differentiating between `ERROR_NETWORK` and `ERROR_NETWORK_TIMEOUT` are currently mapped to `network` on `event.error`. With this change you can now use `event.code` to see the exact error that was thrown.

  ```ts
  import {
    SpeechRecognizerErrorAndroid,
    useSpeechRecognitionEvent,
  } from "expo-speech-recognition";

  useSpeechRecognitionEvent("error", (event) => {
    if (Platform.OS === "android") {
      switch (event.code) {
        case SpeechRecognizerErrorAndroid.ERROR_NETWORK:
          break;
        case SpeechRecognizerErrorAndroid.ERROR_NETWORK_TIMEOUT:
          break;
        case -1:
          // An error usually thrown by the this library
          break;
      }
    }
  });
  ```

## 2.1.3

### Patch Changes

- 86b0b5b: Fixed an Android unhandled `ArrayIndexOutOfBoundsException` crash when the audio recording fails.

  This may happen when [`audioRecorder.read()`](<https://developer.android.com/reference/android/media/AudioRecord#read(short[],%20int,%20int,%20int)>) returns [`ERROR_INVALID_OPERATION`](https://developer.android.com/reference/android/media/AudioRecord#ERROR_INVALID_OPERATION), [`ERROR_BAD_VALUE`](https://developer.android.com/reference/android/media/AudioRecord#ERROR_BAD_VALUE), [`ERROR_DEAD_OBJECT`](https://developer.android.com/reference/android/media/AudioRecord#ERROR_DEAD_OBJECT), or the more generic [`ERROR`](https://developer.android.com/reference/android/media/AudioRecord#ERROR)

## 2.1.2

### Patch Changes

- 3898ff6: iOS: Changed the default file extension of recordings from .caf to .wav

  The recording files always had WAV headers so the file extension now accurately matches this.

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
