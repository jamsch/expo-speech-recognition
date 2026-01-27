---
"expo-speech-recognition": minor
---

(iOS) Added support for handling audio interruptions and route changes on iOS. With these changes this means:

- When the audio route changes (e.g. a bluetooth headset connects), this library will try to switch the recording microphone and keep speech recognition active.
  - If this fails, you'll receive the following error alongside the `end` event:

```json
{
  "code": "audio-capture",
  "message": "Audio route changed and failed to restart the audio engine"
}
```

- When receiving an interruption (e.g. phone call, Siri, alarm), you'll receive this `error` event alongside the `end` event:

```json
{
  "code": "interrupted",
  "message": "Audio session was interrupted"
}
```
