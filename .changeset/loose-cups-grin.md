---
"expo-speech-recognition": patch
---

Add native event error codes for Android.

For advanced use cases where you'd like to debug the exact underlying SpeechRecognizer issue you can now access `event.code` from the error event. You can also use the `SpeechRecognizerErrorAndroid` enum on the event code.

Error codes with the value of `-1` are thrown by this library and not by the `SpeechRecognizer`.

For example, both `ERROR_NETWORK` and `ERROR_NETWORK_TIMEOUT` are mapped to `network` on `event.error`, but now with this change you can more easily discriminate between the errors:

```ts
import {
  SpeechRecognizerErrorAndroid,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

useSpeechRecognitionEvent("error", (event) => {
  if (Platform.OS === "android") {
    switch (event.code) {
      case SpeechRecognizerErrorAndroid.ERROR_NETWORK:
        break;
      case SpeechRecognizerErrorAndroid.ERROR_NETWORK_TIMEOUT:
        break;
      case -1:
        // An error usually thrown by the this library
        break;
    }
  }
});
```
