import {
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import { ExpoSpeechRecognition } from "expo-speech-recognition";
import { useRef, useState } from "react";

const useSpeechRecognition = () => {
  const [transcription, setTranscription] = useState<null | {
    isFinal: boolean;
    transcript: string;
  }>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "recognizing">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<ExpoSpeechRecognition>();

  const startListening = async () => {
    if (status !== "idle") {
      return;
    }

    // Clear the previous transcription
    setTranscription(null);
    setStatus("starting");
    recognition.current = new ExpoSpeechRecognition();
    recognition.current.lang = "en-US";
    recognition.current.interimResults = true;
    recognition.current.maxAlternatives = 1;
    recognition.current.continuous = true;

    recognition.current.onstart = () => {
      setStatus("recognizing");
    };

    recognition.current.onresult = (event) => {
      setTranscription({
        isFinal: event.results[0].isFinal,
        transcript: event.results[0][event.resultIndex].transcript,
      });
    };

    recognition.current.onerror = (event) => {
      setError(event.error);
      setStatus("idle");
    };

    recognition.current.start();
  };

  const stopListening = async () => {
    recognition.current?.stop();
  };

  return {
    status,
    transcription,
    error,
    startListening,
    stopListening,
  };
};

export default function App() {
  const { status, transcription, error, startListening, stopListening } =
    useSpeechRecognition();

  return (
    <SafeAreaView style={styles.container}>
      <Text>Status: {status}</Text>
      <Text>Error: {error}</Text>

      <Text>Transcript</Text>
      <ScrollView>
        <Text>{JSON.stringify(transcription)}</Text>
      </ScrollView>

      <Button
        title="Start"
        disabled={status !== "idle"}
        onPress={startListening}
      />
      <Button
        title="Stop"
        disabled={status !== "recognizing"}
        onPress={stopListening}
      />
    </SafeAreaView>
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
