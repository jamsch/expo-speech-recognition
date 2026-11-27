---
"expo-speech-recognition": patch
---

fix(ios): emit a `not-allowed` error when `requiresOnDeviceRecognition` is set but on-device recognition is unavailable for the locale, instead of silently falling back to network recognition
