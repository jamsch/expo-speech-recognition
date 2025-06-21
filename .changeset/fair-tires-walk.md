---
"expo-speech-recognition": patch
---

Fix: restricted speech recognition permissions for iOS will now be classified as "denied" instead of "undetermined"

You can now use `restricted` to check whether speech recognition is restricted:

```ts
const permissions = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
if (!permissions.granted) {
  if (permissions.restricted) {
    // Ask user to enable speech recognition on their device, either in:
    // Settings -> Screen Time -> Content & Privacy Restrictions -> Speech Recognition
    // or Settings -> General -> VPN & Device Management
    // (if it is part of a MDM profile, see: https://support.apple.com/en-us/guide/deployment/depc0aadd3fe/web)
  } else {
    // Ask user to enable speech recognition for your app
  }
  return;
}
```
