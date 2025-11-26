---
"expo-speech-recognition": patch
---

(iOS) Allow passing through folder URIs for audio persistence.

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
