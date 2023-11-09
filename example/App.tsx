import { Button, StyleSheet, View } from "react-native";

import { ExpoSpeechRecognition } from "expo-speech-recognition";

let recognition: ExpoSpeechRecognition | null = null;
const start = () => {
  if (!recognition) {
    recognition = new ExpoSpeechRecognition();
    recognition.lang = "en-US";
    recognition.onstart = () => {
      console.log("started");
    };
    recognition.onresult = (event) => {
      console.log(event);
    };
    recognition.onerror = (event) => {
      console.log(event);
    };
    recognition.onend = () => {
      console.log("ended");
    };
  }
  recognition.start();
};

export default function App() {
  /*
  const start = async () => {
    const { status } = await ExpoSpeechRecognition.requestPermissionsAsync();
    if (status !== "granted") {
      alert("Permission to access speech recognition is not granted");
      return;
    }
    try {
      await ExpoSpeechRecognition.startListeningAsync({
        language: "en-US",
        onTranscriptionComplete: (result) => {
          console.log(result);
        },
      });
    } catch (error) {
      console.log(error);
    }
  }
  */

  return (
    <View style={styles.container}>
      <Button title="start" onPress={start} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
