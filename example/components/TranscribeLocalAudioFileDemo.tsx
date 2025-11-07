import { useAssets } from "expo-asset";
import {
  AudioEncodingAndroid,
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useState } from "react";
import { Platform } from "react-native";
import { Card } from "./ui/Card";
import { BigButton } from "./ui/Buttons";
import { MonoText } from "./ui/MonoText";

export function TranscribeLocalAudioFileDemo() {
  const [busy, setBusy] = useState(false);
  const [assets] = useAssets([require("../assets/audio/en-us-sentence.wav")]);

  const localUri = assets?.[0]?.localUri;

  const handleTranscribe = () => {
    if (!localUri) {
      console.warn("No local URI");
      return;
    }

    setBusy(true);
    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: true,
      requiresOnDeviceRecognition: Platform.OS === "ios",
      audioSource: {
        uri: localUri,
        audioChannels: 1,
        audioEncoding: AudioEncodingAndroid.ENCODING_PCM_16BIT,
        sampleRate: 16000,
        // chunkDelayMillis: 50,
      },
    });
  };

  useSpeechRecognitionEvent("end", () => setBusy(false));

  return (
    <Card>
      <MonoText style={{ marginBottom: 8 }}>{localUri || ""}</MonoText>
      <BigButton
        disabled={busy}
        color="#539bf5"
        title={busy ? "Transcribing..." : "Transcribe local en-US audio file"}
        onPress={handleTranscribe}
      />
    </Card>
  );
}
