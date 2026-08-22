---
"expo-speech-recognition": patch
---

## Bug fixes

Android: Calling `stop()` during a continuous session could emit a `client` error (code 5)
instead of a final `result`, losing the transcript of the segment that was still open
([#158](https://github.com/jamsch/expo-speech-recognition/issues/158),
[#165](https://github.com/jamsch/expo-speech-recognition/issues/165)). When the recognizer is
reading from a `EXTRA_AUDIO_SOURCE` segmented session, `stop()` now closes the audio source and
waits for the recognizer to finalize the open segment instead of cutting it off with
`stopListening()`. An `end` event is emitted even if the recognizer never reports back.

Android: The recorded audio file is now finalized after the recording thread has drained, so the
`uri` on `audioend` no longer risks missing the tail of the recording.

## Maintenance

- Added `expo-audio` to the example app and allow playback of recordings
- Bump expo version to latest
- Bump module-scripts to v56 to match expo
- Update lockfile to fix vulnerabilities
