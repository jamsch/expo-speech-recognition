import {
  ExpoWebSpeechRecognition,
  ExpoSpeechRecognitionModule,
} from "expo-speech-recognition";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { BigButton } from "./ui/Buttons";
import { Card } from "./ui/Card";
import { MonoText } from "./ui/MonoText";

export function WebSpeechAPIDemo() {
  const [error, setError] = useState<{ code: string; message: string } | null>(
    null,
  );
  const [listening, setListening] = useState(false);
  const [transcription, setTranscription] = useState<null | {
    isFinal: boolean;
    transcript: string;
  }>(null);

  const recognizer = useMemo(() => new ExpoWebSpeechRecognition(), []);

  useEffect(() => {
    if (!listening) {
      return;
    }
    const handleResult = (ev: SpeechRecognitionEventMap["result"]) => {
      console.log("[WebSpeechAPIDemo] result", ev.results);
      setTranscription({
        isFinal: ev.results[ev.resultIndex]?.isFinal,
        transcript: ev.results[ev.resultIndex].item(0)?.transcript,
      });
    };

    const handleError = (ev: SpeechRecognitionEventMap["error"]) => {
      console.log("error code:", ev.error, "error messsage:", ev.message);
      setError({
        code: ev.error,
        message: ev.message,
      });
    };

    const handleEnd = () => {
      setListening(false);
    };

    recognizer.addEventListener("result", handleResult);
    recognizer.addEventListener("error", handleError);
    recognizer.addEventListener("end", handleEnd);

    return () => {
      recognizer.removeEventListener("result", handleResult);
      recognizer.removeEventListener("error", handleError);
      recognizer.removeEventListener("end", handleEnd);
    };
  }, [listening, recognizer]);

  const startListeningWeb = () => {
    setListening(true);
    setTranscription(null);
    setError(null);
    ExpoSpeechRecognitionModule.requestPermissionsAsync().then((result) => {
      console.log("Permissions", result);
      if (!result.granted) {
        console.log("Permissions not granted", result);
        return;
      }
      recognizer.lang = "en-US";
      recognizer.continuous = true;
      recognizer.interimResults = true;
      recognizer.start();
    });
  };

  return (
    <Card>
      {!listening ? (
        <BigButton
          color="#53917E"
          title="Start Recognition (Web Speech API)"
          onPress={startListeningWeb}
        />
      ) : (
        <View style={styles.buttonContainer}>
          <BigButton
            color="#B1B695"
            title="Stop Recognition"
            onPress={() => recognizer.stop()}
          />
          <BigButton
            color="#B1B695"
            title="Abort Recognition"
            onPress={() => recognizer.abort()}
          />
        </View>
      )}

      <MonoText>Errors: {JSON.stringify(error)}</MonoText>

      <ScrollView>
        <MonoText>
          {transcription?.transcript || "Transcripts goes here"}
        </MonoText>
      </ScrollView>
    </Card>
  );
}

const styles = StyleSheet.create({
  buttonContainer: {
    flexDirection: "row",
    gap: 4,
  },
});
