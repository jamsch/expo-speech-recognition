# expo-speech-recognition

expo-speech-recognition implements `SpeechRecognition` from the [Web Speech API](https://wicg.github.io/speech-api/) specification for React Native projects with the goal of code reuse across web and mobile.

# Installation

1. Install the package

```
npm install expo-speech-recognition
```

2. Configure the config plugin.

> The config plugin updates the Android App Manifest to include package visibility filtering for `com.google.android.googlequicksearchbox` (Google's Speech Recognition) along with the required permissions for Android and iOS.

```js
// app.json
{
  "expo": {
    "plugins": [
      [
        "expo-speech-recognition",
        {
          "microphonePermission": "Allow $(PRODUCT_NAME) to use the microphone.",
          "speechRecognitionPermission": "Allow $(PRODUCT_NAME) to use speech recognition."
        }
      ]
    ]
  }
}
```
