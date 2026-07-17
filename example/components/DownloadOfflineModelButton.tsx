import {
  type AndroidModelDownloadHandle,
  downloadAndroidOfflineModel,
  SpeechRecognizerErrorAndroid,
} from "expo-speech-recognition";
import { useEffect, useRef, useState } from "react";
import { Alert, Text, TouchableNativeFeedback, View } from "react-native";

export function DownloadOfflineModelButton(props: { locale: string }) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const downloadRef = useRef<AndroidModelDownloadHandle | null>(null);

  useEffect(() => {
    return () => {
      downloadRef.current?.dispose();
      downloadRef.current = null;
    };
  }, []);

  const handleDownload = () => {
    downloadRef.current?.dispose();
    downloadRef.current = null;

    setDownloading(true);
    setProgress(null);

    downloadRef.current = downloadAndroidOfflineModel(props.locale)
      .on("progress", (value) => {
        console.log(`Downloading... ${value}%`);
        setProgress(value);
      })
      .on("scheduled", () => {
        console.log(
          "Download queued for later (e.g. waiting for Wi‑Fi). No further events on this handle — check getSupportedLocales() later.",
        );
        downloadRef.current = null;
        setDownloading(false);
        setProgress(null);
      })
      .on("success", () => {
        console.log("Offline model downloaded successfully!");
        downloadRef.current = null;
        setDownloading(false);
        setProgress(null);
      })
      .on("error", (code) => {
        switch (code) {
          case SpeechRecognizerErrorAndroid.ERROR_CLIENT:
            console.log("Cancelled by the user");
            break;
          default:
            console.log(
              `Failed to download offline model! Error code: ${code}`,
            );
            break;
        }
        downloadRef.current = null;
        setDownloading(false);
        setProgress(null);
      })
      .on("opened_dialog", () => {
        console.log(
          "Android 13: system download dialog opened (fire-and-forget). Complete it there, then check getSupportedLocales().",
        );
        downloadRef.current = null;
        setDownloading(false);
        setProgress(null);
      });
  };

  const label = downloading
    ? progress != null
      ? `Downloading ${props.locale}… ${progress}%`
      : `Downloading ${props.locale} model…`
    : `Download ${props.locale} Offline Model`;

  return (
    <TouchableNativeFeedback disabled={downloading} onPress={handleDownload}>
      <View>
        <Text
          style={{
            fontWeight: "bold",
            color: downloading ? "#999" : "#539bf5",
          }}
          adjustsFontSizeToFit
        >
          {label}
        </Text>
      </View>
    </TouchableNativeFeedback>
  );
}
