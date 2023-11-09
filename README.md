# 🎙️ expo-speech-recognition

expo-speech-recognition implements `SpeechRecognition` from the [Web Speech API](https://wicg.github.io/speech-api/) specification for React Native projects with the goal of code reuse across web and mobile.

## Installation

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

## Usage

Refer to the [SpeechRecognition MDN docs](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) for usage. Note that some features (such as `grammars` and `continuous`) aren't yet supported.

```ts
import { ExpoSpeechRecognition } from "@jamsch/expo-speech-recognition";

const speech = new ExpoSpeechRecognition();

// Set language (Normalized)
speech.lang = "en-US";
// Enable interim results
speech.interim = true;
// The amount of results
recognition.maxAlternatives = 1;

// Assign an event listener (Overwrites all "start" event listeners)
speech.onstart = (event) => console.log("started!");

// ... or register an event listener
speech.registerEventListener("start", (event) => console.log("started!"));

speech.registerEventListener("result", (event) => {
  // Concatenate every speech result transcript
  const result = event.results[event.resultIndex];
  const firstResult = result?.[0];
  console.log("result:", result?.transcript, "is final:", result?.isFinal);
});

speech.registerEventListener("error", (event) => {
  const errorCode = event.error;
  const errorMessage = event.message;
  console.log("an error occurred:", errorCode, "with messsage:", errorMessage);
}

speech.registerEventListener("end", (event) => console.log("ended!"));

// Start speech recognition
speech.start();

// Stop speech recognition
speech.stop(); // or speech.abort()
```
