---
"expo-speech-recognition": patch
---

## Bug fixes

Android: Calling `stop()` could emit a `client` error (code 5) instead of a
final `result` event, losing the transcript of the segment that was still open.
