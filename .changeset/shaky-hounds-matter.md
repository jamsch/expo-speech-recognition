---
"expo-speech-recognition": major
---

With this major version change, we've removed some top-level exports from the base `expo-speech-recognition` library.
Instead you'll now need to call the function directly from `ExpoSpeechRecognitionModule`. This was changed to address
issues with regards to symbol bindings.

The list of removed exports:

```ts
// Removed
import { getSupportedLocales } from "expo-speech-recognition";
// Instead use:
ExpoSpeechRecognitionModule.getSupportedLocales();
```

```ts
// Removed
import { getSpeechRecognitionServices } from "expo-speech-recognition";
// Instead use:
ExpoSpeechRecognitionModule.getSpeechRecognitionServices();
```

```ts
// Removed
import { supportsOnDeviceRecognition } from "expo-speech-recognition";
// Instead use:
ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
```

```ts
// Removed
import { supportsRecording } from "expo-speech-recognition";
// Instead use:
ExpoSpeechRecognitionModule.supportsRecording();
```

```ts
// Removed
import { setCategoryIOS } from "expo-speech-recognition";
// Instead use:
ExpoSpeechRecognitionModule.setCategoryIOS({ ... });
```

```ts
// Removed
import { getAudioSessionCategoryAndOptionsIOS } from "expo-speech-recognition";
// Instead use:
ExpoSpeechRecognitionModule.getAudioSessionCategoryAndOptionsIOS();
```

```ts
// Removed
import { setAudioSessionActiveIOS } from "expo-speech-recognition";
// Instead use:
ExpoSpeechRecognitionModule.setAudioSessionActiveIOS(true, { ... });
```

```ts
// Removed
import { androidTriggerOfflineModelDownload } from "expo-speech-recognition";
// Instead use:
ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ ... });
```

```ts
// Removed
import { isRecognitionAvailable } from "expo-speech-recognition";
// Instead use:
ExpoSpeechRecognitionModule.isRecognitionAvailable();
```

```ts
// Removed
import { getDefaultRecognitionService } from "expo-speech-recognition";
// Instead use:
ExpoSpeechRecognitionModule.getDefaultRecognitionService();
```

```ts
// Removed
import { getAssistantService } from "expo-speech-recognition";
// Instead use:
ExpoSpeechRecognitionModule.getAssistantService();
```

```ts
// Removed
import { addSpeechRecognitionListener } from "expo-speech-recognition";
// Instead use:
ExpoSpeechRecognitionModule.addListener("foo", (event) => { ... });
```
