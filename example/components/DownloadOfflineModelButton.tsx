import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import { useState } from "react";
import { Alert, Text, TouchableNativeFeedback, View } from "react-native";

export function DownloadOfflineModelButton(props: { locale: string }) {
  const [downloading, setDownloading] = useState<{ locale: string } | null>(
    null,
  );

  const handleDownload = () => {
    setDownloading({ locale: props.locale });

    ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({
      locale: props.locale,
    })
      .then((result) => {
        if (result.status === "opened_dialog") {
          // On Android 13, the status will be "opened_dialog" indicating that the model download dialog was opened.
          Alert.alert("Offline model download dialog opened.");
        } else if (result.status === "download_success") {
          // On Android 14+, the status will be "download_success" indicating that the model download was successful.
          Alert.alert("Offline model downloaded successfully!");
        } else if (result.status === "download_canceled") {
          // On Android 14+, the download was canceled by a user interaction.
          Alert.alert("Offline model download was canceled.");
        }
      })
      .catch((err) => {
        Alert.alert("Failed to download offline model!", err.message);
      })
      .finally(() => {
        setDownloading(null);
      });
  };

  return (
    <TouchableNativeFeedback
      disabled={Boolean(downloading)}
      onPress={handleDownload}
    >
      <View>
        <Text
          style={{
            fontWeight: "bold",
            color: downloading ? "#999" : "#539bf5",
          }}
          adjustsFontSizeToFit
        >
          {downloading
            ? `Downloading ${props.locale} model...`
            : `Download ${props.locale} Offline Model`}
        </Text>
      </View>
    </TouchableNativeFeedback>
  );
}
