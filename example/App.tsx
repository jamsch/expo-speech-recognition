import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  createSpeechRecognizer,
  ExpoSpeechRecognitionModule,
  getSpeechRecognitionServices,
  getSupportedLocales,
  type ExpoSpeechRecognitionOptions,
} from "expo-speech-recognition";
import { useEffect, useState } from "react";
import { OptionButton, CheckboxButton, BigButton } from "./components/Buttons";
import { StatusBar } from "expo-status-bar";

const recognizer = createSpeechRecognizer();

const speechRecognitionServices = getSpeechRecognitionServices();

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

  const [settings, setSettings] = useState<ExpoSpeechRecognitionOptions>({
    lang: "en-US",
    interimResults: true,
    maxAlternatives: 3,
    continuous: true,
    requiresOnDeviceRecognition: false,
    addsPunctuation: true,
    contextualStrings: ["Carlsen", "Ian Nepomniachtchi", "Praggnanandhaa"],
  });

  recognizer.useEvent("result", (ev) => {
    const result = ev.results[ev.resultIndex];

    const transcripts: string[] = [];
    for (let i = 0; i < result.length; i++) {
      transcripts.push(result[i].transcript);
    }

    console.log("[event]: result", {
      isFinal: ev.results[0].isFinal,
      transcripts,
    });

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
    setTranscription(null);
    setError(null);
    setStatus("starting");
    recognizer.start(settings);
  };

  const stopListening = () => {
    recognizer.stop();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" translucent={false} />

      <View style={styles.card}>
        <Text style={styles.text}>
          {error ? JSON.stringify(error) : "Error messages go here"}
        </Text>
      </View>

      <ScrollView style={[styles.card, { height: 140, maxHeight: 140 }]}>
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

      <ScrollView style={styles.card}>
        <Settings value={settings} onChange={setSettings} />
      </ScrollView>

      <View
        style={[
          styles.card,
          styles.buttonContainer,
          { justifyContent: "space-between" },
        ]}
      >
        {Platform.OS === "android" && (
          <DownloadOfflineModel locale={settings.lang} />
        )}

        {status === "idle" ? (
          <BigButton title="Start Recognition" onPress={startListening} />
        ) : (
          <BigButton
            title="Stop Recognition"
            disabled={status !== "recognizing"}
            onPress={stopListening}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function DownloadOfflineModel(props: { locale: string }) {
  const [downloading, setDownloading] = useState<{ locale: string } | null>(
    null,
  );

  const handleDownload = () => {
    setDownloading({ locale: props.locale });

    ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({
      locale: props.locale,
    })
      .then(() => {
        Alert.alert("Offline model downloaded successfully!");
      })
      .catch((err) => {
        Alert.alert("Failed to download offline model!", err.message);
      })
      .finally(() => setDownloading(null));
  };

  return (
    <BigButton
      disabled={Boolean(downloading)}
      title={
        downloading
          ? `Downloading ${props.locale} model...`
          : "Download Offline Model"
      }
      onPress={handleDownload}
    />
  );
}

function Settings(props: {
  value: ExpoSpeechRecognitionOptions;
  onChange: (v: ExpoSpeechRecognitionOptions) => void;
}) {
  const { value: settings, onChange } = props;

  const handleChange = <T extends keyof ExpoSpeechRecognitionOptions>(
    key: T,
    value: ExpoSpeechRecognitionOptions[T],
  ) => {
    onChange({ ...props.value, [key]: value });
  };

  const [supportedLocales, setSupportedLocales] = useState<{
    locales: string[];
    installedLocales: string[];
  }>({ locales: [], installedLocales: [] });
  useEffect(() => {
    getSupportedLocales({
      onDevice: settings.requiresOnDeviceRecognition,
      androidRecognitionServicePackage:
        settings.androidRecognitionServicePackage,
    }).then(setSupportedLocales);
  }, [
    settings.requiresOnDeviceRecognition,
    settings.androidRecognitionServicePackage,
  ]);

  return (
    <View>
      <View style={{ flexDirection: "row", gap: 2, flexWrap: "wrap" }}>
        <CheckboxButton
          title="Continuous (iOS only)"
          checked={settings.continuous}
          onPress={() => handleChange("continuous", !settings.continuous)}
        />
        <CheckboxButton
          title="Interim Results"
          checked={settings.interimResults}
          onPress={() =>
            handleChange("interimResults", !settings.interimResults)
          }
        />
        <CheckboxButton
          title="Punctuation"
          checked={settings.addsPunctuation}
          onPress={() =>
            handleChange("addsPunctuation", !settings.addsPunctuation)
          }
        />
        <CheckboxButton
          title="OnDevice Recognition"
          checked={settings.requiresOnDeviceRecognition}
          onPress={() =>
            handleChange(
              "requiresOnDeviceRecognition",
              !settings.requiresOnDeviceRecognition,
            )
          }
        />
      </View>

      <View style={styles.textOptionContainer}>
        <Text style={styles.textLabel}>Max Alternatives</Text>
        <TextInput
          style={styles.textInput}
          keyboardType="number-pad"
          autoCorrect={false}
          defaultValue={String(settings.maxAlternatives)}
          onChangeText={(v) => handleChange("maxAlternatives", Number(v) || 1)}
        />
      </View>
      {Platform.OS === "android" && (
        <View>
          <Text style={styles.textLabel}>Android Recognition Service</Text>
          <View style={[styles.row, styles.flexWrap]}>
            {speechRecognitionServices.map((service) => (
              <OptionButton
                key={service}
                title={service}
                active={settings.androidRecognitionServicePackage === service}
                onPress={() => {
                  handleChange("androidRecognitionServicePackage", service);
                }}
              />
            ))}
          </View>
        </View>
      )}
      <View>
        <Text style={styles.textLabel}>Locale</Text>
        <Text style={[styles.textLabel, { color: "#999" }]}>
          Your {Platform.OS} device supports {supportedLocales.locales.length}{" "}
          locales{" "}
          {settings.requiresOnDeviceRecognition
            ? `(${supportedLocales.installedLocales.length} installed)`
            : ""}
        </Text>

        <ScrollView
          style={{ height: 100, maxHeight: 150 }}
          contentContainerStyle={[styles.row, styles.flexWrap]}
        >
          {supportedLocales.locales.map((locale) => {
            const isInstalled =
              Platform.OS === "android" &&
              supportedLocales.installedLocales.includes(locale);
            return (
              <OptionButton
                key={locale}
                color={isInstalled ? "#00c853" : "#999"}
                title={
                  isInstalled
                    ? `${locale} (${
                        supportedLocales.installedLocales.includes(locale)
                          ? "installed"
                          : "not installed"
                      })`
                    : locale
                }
                active={settings.lang === locale}
                onPress={() => handleChange("lang", locale)}
              />
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 10,
    padding: 10,
    backgroundColor: "#eee",
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
  textLabel: {
    fontSize: 12,
    color: "#111",
    fontWeight: "bold",
  },
  textOptionContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 10,
  },
  textInput: {
    height: 30,
    minWidth: 60,
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 5,
  },
  flex1: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
  },
  flexWrap: {
    flexWrap: "wrap",
  },
});
