# Example app for expo-speech-recognition

This example app showcases most of the features of the `expo-speech-recognition` library. To get started:

```sh
# Install dependencies
npm install

# Also install dependencies of the root folder
cd ../
npm install

# Build the expo-speech-recognition library
npm run prepare

# Go back to the example folder and build the app
cd example

# Build the iOS app
npm run ios
# Build the Android app
npm run android

# Run the Metro JS bundling server
npm start
```

## Troubleshooting

### Microphone not working on Android emulator

Run either of the following commands to make sure that the host operating system is linked to the Android emulator:

```sh
adb emu avd hostmicon

npm run android:fix-emulator-mic
```
