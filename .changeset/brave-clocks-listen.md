---
"expo-speech-recognition": minor
---

Add `timestamp` to the `audiostart` and `audioend` events ([#179](https://github.com/jamsch/expo-speech-recognition/issues/179)). It's the epoch time in milliseconds when capturing started or stopped, recorded natively so a busy JS thread can't delay it. Use it to line up app events with positions in a persisted recording.

Android: `audiostart` reported `uri` as the string `"file://null"` when recording without `recordingOptions.persist`. It's now `null`, matching `audioend` and iOS.
