import { File, Paths } from "expo-file-system";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  type AudioEncodingAndroidValue,
} from "expo-speech-recognition";
import { useState } from "react";
import { Card } from "./ui/Card";
import { MonoText } from "./ui/MonoText";
import { BigButton } from "./ui/Buttons";

export function TranscribeRemoteAudioFileDemo(props: {
  remoteUrl: string;
  description: string;
  audioEncoding: AudioEncodingAndroidValue;
  fileName: string;
}) {
  const [busy, setBusy] = useState(false);
  const handleTranscribe = async () => {
    setBusy(true);
    // download the file

    const file = new File(Paths.join(Paths.cache, props.fileName));
    const response = await File.downloadFileAsync(props.remoteUrl, file, {
      idempotent: true,
    });

    if (!response.exists) {
      console.warn("Failed to download file", file);
      setBusy(false);
      return;
    }
    console.log("Downloaded file", file);
    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: true,
      audioSource: {
        uri: file.uri,
        audioChannels: 1,
        audioEncoding: props.audioEncoding,
        sampleRate: 16000,
      },
    });
  };

  useSpeechRecognitionEvent("end", () => setBusy(false));

  return (
    <Card>
      <MonoText style={{ marginBottom: 8 }}>{props.description}</MonoText>
      <MonoText style={{ marginBottom: 8 }}>{props.remoteUrl}</MonoText>
      <BigButton
        disabled={busy}
        color="#539bf5"
        title={busy ? "Transcribing..." : "Transcribe remote audio file"}
        onPress={handleTranscribe}
      />
    </Card>
  );
}
