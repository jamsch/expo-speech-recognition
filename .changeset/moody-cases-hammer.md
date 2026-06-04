---
"expo-speech-recognition": patch
---

- Fix `getSupportedLocales` and `androidTriggerOfflineModelDownload` double-resolve issue for Android
- Type breakages: `androidTriggerOfflineModelDownload()` has a renamed status enum (from `download_canceled` to `download_scheduled`).
