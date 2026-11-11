---
"expo-speech-recognition": minor
---

Android: add the `androidAudioInputDeviceId` start option to choose which microphone to record from ([#76](https://github.com/jamsch/expo-speech-recognition/issues/76)). It's the id of an input `AudioDeviceInfo` (e.g. a wired, USB or Bluetooth headset mic), applied with `AudioRecord.setPreferredDevice()` to the recorder the library opens on Android 13+ in continuous mode or when persisting recordings. Previously that recorder always used the system's default input.
