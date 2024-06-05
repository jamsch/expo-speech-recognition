import {
  Button,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { createSpeechRecognizer } from "expo-speech-recognition";
import { useState } from "react";

const recognizer = createSpeechRecognizer();

export default function App() {
  const [error, setError] = useState<{ code: string; message: string } | null>(
    null,
  );

  const [transcription, setTranscription] = useState<null | {
    isFinal: boolean;
    transcript: string;
  }>(null);

  const [status, setStatus] = useState<"idle" | "starting" | "recognizing">(
    "idle",
  );

  recognizer.useEvent("result", (ev) => {
    console.log("[event]: result, isFinal:", ev.results[0].isFinal);
    setTranscription({
      isFinal: ev.results[0].isFinal,
      transcript: ev.results[ev.resultIndex][0].transcript,
    });
  });

  recognizer.useEvent("start", () => {
    console.log("[event]: start");
    setStatus("recognizing");
  });

  recognizer.useEvent("end", () => {
    console.log("[event]: end");
    setStatus("idle");
  });

  recognizer.useEvent("error", (ev) => {
    console.log("[event]: error", ev.error, ev.message);
    setError({
      code: ev.error,
      message: ev.message,
    });
  });

  const startListening = () => {
    if (status !== "idle") {
      return;
    }
    setError(null);
    setStatus("starting");
    recognizer.start({
      lang: "hi-IN-translit",
      interimResults: true,
      maxAlternatives: 3,
      continuous: false,
      requiresOnDeviceRecognition: false,
      addsPunctuation: true,
      contextualStrings: ["Carlsen", "Ian Nepomniachtchi", "Praggnanandhaa"],
    });
  };

  const stopListening = () => {
    recognizer.stop();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.text}>
          {error ? JSON.stringify(error) : "Error messages goes here"}
        </Text>
      </View>

      <ScrollView style={[styles.card, { height: 200 }]}>
        <View>
          <Text style={styles.text}>
            Status:{" "}
            <Text style={{ color: status === "idle" ? "green" : "red" }}>
              {status}
            </Text>
          </Text>
        </View>
        <View style={{ marginTop: 10 }}>
          <Text style={styles.text}>
            {transcription?.transcript || "transcript goes here"}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        {status === "idle" ? (
          <Button title="Start Recognition" onPress={startListening} />
        ) : (
          <Button
            title="Stop Recognition"
            disabled={status !== "recognizing"}
            onPress={stopListening}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 30,
    gap: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#eee",
    padding: 10,
    borderRadius: 10,
    borderColor: "#ccc",
    borderWidth: 2,
    width: "100%",
  },
  buttonContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
  },
  text: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
});
