---
"expo-speech-recognition": patch
---

Add native event error codes for Android.

For advanced use cases where you'd like to debug the platform's underlying speech recognizer you can now access `event.code` from the error event. For Android, you can import the `SpeechRecognizerErrorAndroid` enum to match against this code.

Error codes with the value of `-1` are thrown by this library and not by the `SpeechRecognizer`.

Example use case: differentiating between `ERROR_NETWORK` and `ERROR_NETWORK_TIMEOUT` are currently mapped to `network` on `event.error`. With this change you can now use `event.code` to see the exact error that was thrown.

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
