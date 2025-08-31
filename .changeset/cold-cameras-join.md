---
"expo-speech-recognition": minor
---

Implemented an `available()` method to check if a given locale is available and whether it's available to be recognized locally.

This method matches the [Web Speech API implementation](https://webaudio.github.io/web-speech-api/#dom-speechrecognition-available).

```ts
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

// Check if remote English recognition is available
const availability = await ExpoSpeechRecognitionModule.available({
  langs: ["en-US"],
  processLocally: false,
});

console.log("Recognition available:", availability);
// Returns one of: "unavailable" | "downloadable" | "downloading" | "available"

// Check multiple languages with on-device processing
const localAvailability = await ExpoSpeechRecognitionModule.available({
  langs: ["en-US", "es-ES", "fr-FR"],
  processLocally: true,
});

console.log("Local recognition available:", localAvailability);
```
