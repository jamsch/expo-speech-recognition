---
"expo-speech-recognition": minor
---

Android: `getSupportedLocales()` now also returns `supportedOnDeviceLocales`, `pendingOnDeviceLocales` and `onlineLocales`, straight from Android's `RecognitionSupport`. `locales` is the union of installed, supported-on-device and online-only languages, so until now there was no way to tell whether a language has an offline model that can be downloaded (`androidTriggerOfflineModelDownload()`) or is online-only, or whether a download is already pending. The new fields are optional and additive; `locales` and `installedLocales` are unchanged.
