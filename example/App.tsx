import {
  Alert,
  Button,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableNativeFeedback,
  View,
} from "react-native";
import {
  AudioEncodingAndroid,
  ExpoSpeechRecognitionModule,
  getSpeechRecognitionServices,
  getSupportedLocales,
  ExpoSpeechRecognitionModuleEmitter,
  type ExpoSpeechRecognitionOptions,
  type ExpoSpeechRecognitionNativeEventMap,
  type AndroidIntentOptions,
  requestPermissionsAsync,
  useSpeechRecognitionEvent,
  AudioEncodingAndroidValue,
} from "expo-speech-recognition";
import { useEffect, useState } from "react";
import {
  OptionButton,
  CheckboxButton,
  BigButton,
  TabButton,
} from "./components/Buttons";
import { StatusBar } from "expo-status-bar";
import { Audio } from "expo-av";
import { useAssets } from "expo-asset";
import * as FileSystem from "expo-file-system";

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

  useEffect(() => {
    const listener = ExpoSpeechRecognitionModuleEmitter.addListener(
      "recording",
      (event) => {
        console.log("recording:", event);
      },
    );
    return () => {
      listener.remove();
    };
  }, []);

  const [settings, setSettings] = useState<ExpoSpeechRecognitionOptions>({
    lang: "en-US",
    interimResults: true,
    maxAlternatives: 3,
    continuous: true,
    requiresOnDeviceRecognition: false,
    addsPunctuation: true,
    contextualStrings: ["Carlsen", "Ian Nepomniachtchi", "Praggnanandhaa"],
  });

  useSpeechRecognitionEvent("result", (ev) => {
    console.log("[event]: result", {
      isFinal: ev.isFinal,
      transcripts: ev.results.map((result) => result?.transcript),
    });

    setTranscription({
      isFinal: ev.isFinal,
      transcript: ev.results?.[0]?.transcript,
    });
  });

  useSpeechRecognitionEvent("start", () => {
    console.log("[event]: start");
    setStatus("recognizing");
  });

  useSpeechRecognitionEvent("end", () => {
    console.log("[event]: end");
    setStatus("idle");
  });

  useSpeechRecognitionEvent("error", (ev) => {
    console.log("[event]: error", ev.code, ev.message);
    setError({
      code: ev.code,
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
    requestPermissionsAsync().then((result) => {
      console.log("Permissions", result);
      if (!result.granted) {
        console.log("Permissions not granted", result);
        return;
      }
      ExpoSpeechRecognitionModule.start(settings);
    });
  };

  const stopListening = () => {
    ExpoSpeechRecognitionModule.stop();
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

      <ScrollView
        style={styles.card}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <Settings value={settings} onChange={setSettings} />
      </ScrollView>

      <View
        style={[
          styles.card,
          styles.buttonContainer,
          { justifyContent: "space-between" },
        ]}
      >
        {Platform.OS === "android" && settings.requiresOnDeviceRecognition && (
          <DownloadOfflineModel locale={settings.lang ?? "en-US"} />
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
    <TouchableNativeFeedback
      disabled={Boolean(downloading)}
      onPress={handleDownload}
    >
      <View style={{ maxWidth: 200 }}>
        <Text
          style={{
            fontWeight: "bold",
            color: downloading ? "#999" : "#539bf5",
          }}
        >
          {downloading
            ? `Downloading ${props.locale} model...`
            : `Download ${props.locale} Offline Model`}
        </Text>
      </View>
    </TouchableNativeFeedback>
  );
}

function Settings(props: {
  value: ExpoSpeechRecognitionOptions;
  onChange: (v: ExpoSpeechRecognitionOptions) => void;
}) {
  const { value: settings, onChange } = props;

  const [tab, setTab] = useState<"general" | "android" | "ios" | "other">(
    "general",
  );

  const handleChange = <T extends keyof ExpoSpeechRecognitionOptions>(
    key: T,
    value: ExpoSpeechRecognitionOptions[T],
  ) => {
    onChange({ ...props.value, [key]: value });
  };

  return (
    <View>
      <View style={[styles.flex1, styles.row, styles.mb2, styles.gap1]}>
        <TabButton
          title="General Settings"
          active={tab === "general"}
          onPress={() => {
            setTab("general");
          }}
        />
        <TabButton
          title="Android-specific"
          active={tab === "android"}
          onPress={() => {
            setTab("android");
          }}
        />
        <TabButton
          title="Other"
          active={tab === "other"}
          onPress={() => {
            setTab("other");
          }}
        />
      </View>
      {tab === "general" && (
        <GeneralSettings value={settings} onChange={handleChange} />
      )}
      {tab === "android" && (
        <AndroidSettings value={settings} onChange={handleChange} />
      )}
      {tab === "other" && (
        <OtherSettings value={settings} onChange={handleChange} />
      )}
    </View>
  );
}

function GeneralSettings(props: {
  value: ExpoSpeechRecognitionOptions;
  onChange: <T extends keyof ExpoSpeechRecognitionOptions>(
    key: T,
    value: ExpoSpeechRecognitionOptions[T],
  ) => void;
}) {
  const { value: settings, onChange: handleChange } = props;

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
      <View
        style={[styles.row, styles.flexWrap, { flexDirection: "row", gap: 2 }]}
      >
        <CheckboxButton
          title="Interim Results"
          checked={Boolean(settings.interimResults)}
          onPress={() =>
            handleChange("interimResults", !settings.interimResults)
          }
        />
        <CheckboxButton
          title="Punctuation"
          checked={Boolean(settings.addsPunctuation)}
          onPress={() =>
            handleChange("addsPunctuation", !settings.addsPunctuation)
          }
        />
        <CheckboxButton
          title="OnDevice Recognition"
          checked={Boolean(settings.requiresOnDeviceRecognition)}
          onPress={() =>
            handleChange(
              "requiresOnDeviceRecognition",
              !settings.requiresOnDeviceRecognition,
            )
          }
        />
        <CheckboxButton
          title="Continuous"
          checked={Boolean(settings.continuous)}
          onPress={() => handleChange("continuous", !settings.continuous)}
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
      <View>
        <Text style={styles.textLabel}>Locale</Text>
        <Text style={[styles.textLabel, { color: "#999" }]}>
          Your {Platform.OS} device supports {supportedLocales.locales.length}{" "}
          locales{" "}
          {settings.requiresOnDeviceRecognition
            ? `(${supportedLocales.installedLocales.length} installed)`
            : ""}
        </Text>

        <ScrollView contentContainerStyle={[styles.row, styles.flexWrap]}>
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

const androidIntentNumberInputOptions = [
  "EXTRA_LANGUAGE_SWITCH_MAX_SWITCHES",
  "EXTRA_ORIGIN",
  "EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS",
  "EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS",
  "EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS",
] satisfies (keyof AndroidIntentOptions)[];

const androidIntentBooleanInputOptions = [
  "EXTRA_ENABLE_BIASING_DEVICE_CONTEXT",
  "EXTRA_ENABLE_LANGUAGE_DETECTION",
  "EXTRA_ENABLE_LANGUAGE_SWITCH",
  "EXTRA_HIDE_PARTIAL_TRAILING_PUNCTUATION",
  "EXTRA_MASK_OFFENSIVE_WORDS",
  "EXTRA_REQUEST_WORD_CONFIDENCE",
  "EXTRA_REQUEST_WORD_TIMING",
  "EXTRA_SECURE",
] satisfies (keyof AndroidIntentOptions)[];

function AndroidSettings(props: {
  value: ExpoSpeechRecognitionOptions;
  onChange: <T extends keyof ExpoSpeechRecognitionOptions>(
    key: T,
    value: ExpoSpeechRecognitionOptions[T],
  ) => void;
}) {
  const { value: settings, onChange: handleChange } = props;
  return (
    <View style={styles.gap1}>
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
          {speechRecognitionServices.length === 0 && (
            <Text style={styles.text}>No services found</Text>
          )}
        </View>
      </View>

      <View>
        <Text style={[styles.textLabel, styles.mb2]}>
          Android Intent Options
        </Text>
        <View style={styles.gap1}>
          <View style={styles.flex1}>
            <Text style={styles.textLabel}>EXTRA_LANGUAGE_MODEL</Text>
            <View style={[styles.row, styles.flexWrap]}>
              {[
                "free_form",
                "web_search",
                "balanced",
                "quick_response",
                "high_precision",
              ].map((model) => (
                <OptionButton
                  key={model}
                  title={model}
                  active={Boolean(
                    settings.androidIntentOptions?.EXTRA_LANGUAGE_MODEL ===
                      model,
                  )}
                  onPress={() =>
                    handleChange("androidIntentOptions", {
                      ...settings.androidIntentOptions,
                      EXTRA_LANGUAGE_MODEL:
                        model as AndroidIntentOptions["EXTRA_LANGUAGE_MODEL"],
                    })
                  }
                />
              ))}
            </View>
          </View>
          {androidIntentNumberInputOptions.map((key) => (
            <TextInput
              key={key}
              style={[styles.textInput, styles.flex1]}
              keyboardType="number-pad"
              autoCorrect={false}
              placeholder={key}
              defaultValue={
                settings.androidIntentOptions?.[key]
                  ? String(settings.androidIntentOptions?.[key])
                  : ""
              }
              onChangeText={(v) =>
                handleChange("androidIntentOptions", {
                  ...settings.androidIntentOptions,
                  [key]: Number(v) || 0,
                })
              }
            />
          ))}
          {androidIntentBooleanInputOptions.map((key) => (
            <CheckboxButton
              key={key}
              title={key}
              checked={Boolean(settings.androidIntentOptions?.[key]) ?? false}
              onPress={() =>
                handleChange("androidIntentOptions", {
                  ...settings.androidIntentOptions,
                  [key]: !settings.androidIntentOptions?.[key] ?? false,
                })
              }
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function OtherSettings(props: {
  value: ExpoSpeechRecognitionOptions;
  onChange: <T extends keyof ExpoSpeechRecognitionOptions>(
    key: T,
    value: ExpoSpeechRecognitionOptions[T],
  ) => void;
}) {
  const { value: settings, onChange: handleChange } = props;

  const [recordingPath, setRecordingPath] = useState<string | null>(null);

  useEffect(() => {
    const listener = ExpoSpeechRecognitionModuleEmitter.addListener(
      "recording",
      (event: ExpoSpeechRecognitionNativeEventMap["recording"]) => {
        console.log("Local file path:", event.filePath);
        // Android: Will be saved as a .wav file
        // e.g. "/data/user/0/expo.modules.speechrecognition.example/cache/audio_1720678500903.wav"
        setRecordingPath(event.filePath);
      },
    );
    return listener.remove;
  }, []);

  // Enable audio recording
  return (
    <View style={[styles.gap1]}>
      <CheckboxButton
        title="Persist audio recording to filesystem"
        checked={Boolean(settings.recordingOptions?.persist)}
        onPress={() =>
          handleChange("recordingOptions", {
            ...(settings.recordingOptions ?? {}),
            persist: !settings.recordingOptions?.persist,
          })
        }
      />
      {settings.recordingOptions?.persist ? (
        <View
          style={{
            borderStyle: "dashed",
            borderWidth: 2,
            padding: 10,
            height: 100,
            flex: 1,
          }}
        >
          {recordingPath ? (
            <View>
              <Text style={styles.text}>
                Audio recording saved to {recordingPath}
              </Text>
              <AudioPlayer source={recordingPath} />
            </View>
          ) : (
            <Text style={styles.text}>
              Waiting for speech recognition to end...
            </Text>
          )}
        </View>
      ) : null}

      <TranscribeLocalAudioFile />

      <TranscribeRemoteAudioFile
        fileName="remote-en-us-sentence-16000hz-pcm_s16le.wav"
        remoteUrl="https://github.com/jamsch/expo-speech-recognition/raw/main/example/assets/audio-remote/remote-en-us-sentence-16000hz-pcm_s16le.wav"
        audioEncoding={AudioEncodingAndroid.ENCODING_PCM_16BIT}
        description="16000hz 16-bit 1-channel PCM audio file"
      />

      <TranscribeRemoteAudioFile
        fileName="remote-en-us-sentence-16000hz.mp3"
        remoteUrl="https://github.com/jamsch/expo-speech-recognition/raw/main/example/assets/audio-remote/remote-en-us-sentence-16000hz.mp3"
        audioEncoding={AudioEncodingAndroid.ENCODING_MP3}
        description="(May not work on Android) 16000hz MP3 1-channel audio file"
      />

      <TranscribeRemoteAudioFile
        fileName="remote-en-us-sentence-16000hz.ogg"
        remoteUrl="https://github.com/jamsch/expo-speech-recognition/raw/main/example/assets/audio-remote/remote-en-us-sentence-16000hz.ogg"
        audioEncoding={AudioEncodingAndroid.ENCODING_OPUS}
        description="(May not work on iOS & Android) 16000hz opus 1-channel audio file"
      />
    </View>
  );
}

function TranscribeLocalAudioFile() {
  const [busy, setBusy] = useState(false);
  const [assets] = useAssets([require("./assets/audio/en-us-sentence.wav")]);

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
      audioSource: {
        uri: localUri,
        audioChannels: 1,
        audioEncoding: AudioEncodingAndroid.ENCODING_PCM_16BIT,
        sampleRate: 16000,
      },
    });
  };

  useSpeechRecognitionEvent("end", () => setBusy(false));

  return (
    <View style={styles.card}>
      <Text style={[styles.text, styles.mb2]}>{localUri || ""}</Text>
      <BigButton
        disabled={busy}
        color="#539bf5"
        title={busy ? "Transcribing..." : "Transcribe local en-US audio file"}
        onPress={handleTranscribe}
      />
    </View>
  );
}

function TranscribeRemoteAudioFile(props: {
  remoteUrl: string;
  description: string;
  audioEncoding: AudioEncodingAndroidValue;
  fileName: string;
}) {
  const [busy, setBusy] = useState(false);
  const handleTranscribe = async () => {
    setBusy(true);
    // download the file
    const file = await FileSystem.downloadAsync(
      props.remoteUrl,
      FileSystem.cacheDirectory + props.fileName,
    );
    if (file.status >= 300 || file.status < 200) {
      console.warn("Failed to download file", file);
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
    <View style={styles.card}>
      <Text style={[styles.text, styles.mb2]}>{props.description}</Text>
      <Text style={[styles.text, styles.mb2]}>{props.remoteUrl}</Text>
      <BigButton
        disabled={busy}
        color="#539bf5"
        title={busy ? "Transcribing..." : "Transcribe remote audio file"}
        onPress={handleTranscribe}
      />
    </View>
  );
}

function AudioPlayer(props: { source: string }) {
  const handlePlay = () => {
    Audio.Sound.createAsync({ uri: props.source }, { shouldPlay: true });
  };

  return <Button title="Play back recording" onPress={handlePlay} />;
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
  mb2: {
    marginBottom: 8,
  },
  gap1: {
    gap: 4,
  },
});
