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
  useSpeechRecognitionEvent,
  TaskHintIOS,
  AVAudioSessionCategory,
  AVAudioSessionCategoryOptions,
  AVAudioSessionMode,
  ExpoWebSpeechRecognition,
} from "expo-speech-recognition";
import type {
  AudioEncodingAndroidValue,
  AndroidIntentOptions,
  AVAudioSessionCategoryValue,
  AVAudioSessionModeValue,
  AVAudioSessionCategoryOptionsValue,
  ExpoSpeechRecognitionOptions,
  SetCategoryOptions,
} from "expo-speech-recognition";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  AndroidAudioEncoder,
  AndroidOutputFormat,
  IOSOutputFormat,
} from "expo-av/build/Audio";
import { VolumeMeteringAvatar } from "./components/VolumeMeteringAvatar";

const speechRecognitionServices = getSpeechRecognitionServices();

export default function App() {
  const [error, setError] = useState<{ error: string; message: string } | null>(
    null,
  );

  const [transcription, setTranscription] = useState<null | {
    transcriptTally: string;
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
    contextualStrings: [
      "expo-speech-recognition",
      "Carlsen",
      "Ian Nepomniachtchi",
      "Praggnanandhaa",
    ],
    volumeChangeEventOptions: {
      enabled: false,
      intervalMillis: 300,
    },
  });

  useSpeechRecognitionEvent("result", (ev) => {
    console.log("[event]: result", {
      isFinal: ev.isFinal,
      transcripts: ev.results.map((result) => result.transcript),
    });

    const transcript = ev.results[0]?.transcript || "";

    setTranscription((current) => {
      // When a final result is received, any following recognized transcripts will omit the previous final result
      const transcriptTally = ev.isFinal
        ? (current?.transcriptTally ?? "") + transcript
        : (current?.transcriptTally ?? "");

      return {
        transcriptTally,
        transcript: ev.isFinal ? transcriptTally : transcriptTally + transcript,
      };
    });
  });

  useSpeechRecognitionEvent("start", () => {
    setTranscription(null);
    setStatus("recognizing");
  });

  useSpeechRecognitionEvent("end", () => {
    console.log("[event]: end");
    setStatus("idle");
  });

  useSpeechRecognitionEvent("error", (ev) => {
    console.log("[event]: error", ev.error, ev.message);
    setError(ev);
  });

  useSpeechRecognitionEvent("nomatch", (ev) => {
    console.log("[event]: nomatch");
  });

  useSpeechRecognitionEvent("languagedetection", (ev) => {
    console.log("[event]: languagedetection", ev);
  });

  const startListening = async () => {
    if (status !== "idle") {
      return;
    }
    setTranscription(null);
    setError(null);
    setStatus("starting");

    const microphonePermissions =
      await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync();
    console.log("Microphone permissions", microphonePermissions);
    if (!microphonePermissions.granted) {
      setError({ error: "not-allowed", message: "Permissions not granted" });
      setStatus("idle");
      return;
    }

    if (!settings.requiresOnDeviceRecognition && Platform.OS === "ios") {
      const speechRecognizerPermissions =
        await ExpoSpeechRecognitionModule.requestSpeechRecognizerPermissionsAsync();
      console.log("Speech recognizer permissions", speechRecognizerPermissions);
      if (!speechRecognizerPermissions.granted) {
        setError({ error: "not-allowed", message: "Permissions not granted" });
        setStatus("idle");
        return;
      }
    }

    ExpoSpeechRecognitionModule.start(settings);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" translucent={false} />

      {settings.volumeChangeEventOptions?.enabled ? (
        <VolumeMeteringAvatar />
      ) : null}

      <View style={styles.card}>
        <Text style={styles.text}>
          {error ? JSON.stringify(error) : "Error messages go here"}
        </Text>
      </View>

      <ScrollView
        style={[styles.card, { padding: 0, height: 140, maxHeight: 140 }]}
        contentContainerStyle={{ padding: 10 }}
      >
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
          <View style={styles.flex1}>
            <DownloadOfflineModel locale={settings.lang ?? "en-US"} />
          </View>
        )}

        {status === "idle" ? (
          <BigButton title="Start Recognition" onPress={startListening} />
        ) : (
          <View style={[styles.row, styles.gap1]}>
            <BigButton
              title="Stop"
              disabled={status !== "recognizing"}
              onPress={() => ExpoSpeechRecognitionModule.stop()}
            />
            <BigButton
              title="Abort"
              disabled={status !== "recognizing"}
              onPress={() => ExpoSpeechRecognitionModule.abort()}
            />
          </View>
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
          title="Android"
          active={tab === "android"}
          onPress={() => {
            setTab("android");
          }}
        />
        <TabButton
          title="iOS"
          active={tab === "ios"}
          onPress={() => {
            setTab("ios");
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
      {tab === "ios" && (
        <IOSSettings value={settings} onChange={handleChange} />
      )}
    </View>
  );
}

function IOSSettings(props: {
  value: ExpoSpeechRecognitionOptions;
  onChange: <T extends keyof ExpoSpeechRecognitionOptions>(
    key: T,
    value: ExpoSpeechRecognitionOptions[T],
  ) => void;
}) {
  const { value: settings, onChange: handleChange } = props;

  const updateCategoryOptions = (options: Partial<SetCategoryOptions>) => {
    handleChange("iosCategory", {
      category:
        options.category ?? settings.iosCategory?.category ?? "playAndRecord",
      categoryOptions: options.categoryOptions ??
        settings.iosCategory?.categoryOptions ?? [
          AVAudioSessionCategoryOptions.defaultToSpeaker,
          AVAudioSessionCategoryOptions.allowBluetooth,
        ],
      mode: options.mode ?? settings.iosCategory?.mode ?? "measurement",
    });
  };

  return (
    <View style={styles.gap1}>
      <View style={styles.gap1}>
        <Text style={styles.textLabel}>Task Hint</Text>
        <View style={[styles.row, styles.flexWrap]}>
          {Object.keys(TaskHintIOS).map((hint) => (
            <OptionButton
              key={hint}
              title={hint}
              active={settings.iosTaskHint === hint}
              onPress={() =>
                handleChange("iosTaskHint", hint as keyof typeof TaskHintIOS)
              }
            />
          ))}
        </View>
      </View>
      <View style={styles.gap1}>
        <Text style={styles.textLabel}>Audio Category</Text>
        <View style={[styles.row, styles.flexWrap]}>
          {Object.keys(AVAudioSessionCategory).map((category) => (
            <OptionButton
              key={category}
              title={category}
              active={settings.iosCategory?.category === category}
              onPress={() =>
                updateCategoryOptions({
                  category: category as AVAudioSessionCategoryValue,
                })
              }
            />
          ))}
        </View>
      </View>

      <View style={styles.gap1}>
        <View style={styles.flex1}>
          <Text style={styles.textLabel}>Category Options</Text>
          <View style={[styles.row, styles.flexWrap]}>
            {Object.keys(AVAudioSessionCategoryOptions).map((option) => (
              <CheckboxButton
                key={option}
                title={option}
                checked={Boolean(
                  settings.iosCategory?.categoryOptions?.includes(
                    option as AVAudioSessionCategoryOptionsValue,
                  ),
                )}
                onPress={() => {
                  // Remove the option if it's already selected
                  let newOptions = [
                    ...(settings.iosCategory?.categoryOptions ?? []),
                  ];
                  if (
                    newOptions.includes(
                      option as AVAudioSessionCategoryOptionsValue,
                    )
                  ) {
                    newOptions = newOptions.filter((o) => o !== option);
                  } else {
                    newOptions.push(
                      option as AVAudioSessionCategoryOptionsValue,
                    );
                  }

                  updateCategoryOptions({
                    categoryOptions: newOptions,
                  });
                }}
              />
            ))}
          </View>
        </View>
      </View>

      <View style={styles.gap1}>
        <Text style={styles.textLabel}>Audio Mode</Text>
        <View style={[styles.row, styles.flexWrap]}>
          {Object.keys(AVAudioSessionMode).map((mode) => (
            <OptionButton
              key={mode}
              title={mode}
              active={settings.iosCategory?.mode === mode}
              onPress={() =>
                updateCategoryOptions({
                  mode: mode as AVAudioSessionModeValue,
                })
              }
            />
          ))}
        </View>
      </View>
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
      androidRecognitionServicePackage:
        settings.androidRecognitionServicePackage,
    })
      .then(setSupportedLocales)
      .catch((err) => {
        console.log(
          "Error getting supported locales for package:",
          settings.androidRecognitionServicePackage,
          err,
        );
      });
  }, [settings.androidRecognitionServicePackage]);

  const locales =
    supportedLocales.locales.length === 0
      ? fallbackLocales
      : supportedLocales.locales;

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

        <CheckboxButton
          title="Volume events"
          checked={Boolean(settings.volumeChangeEventOptions?.enabled)}
          onPress={() =>
            handleChange("volumeChangeEventOptions", {
              enabled: !settings.volumeChangeEventOptions?.enabled,
              intervalMillis: settings.volumeChangeEventOptions?.intervalMillis,
            })
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
      <View>
        <Text style={styles.textLabel}>Locale</Text>
        <Text style={[styles.textLabel, { color: "#999" }]}>
          Your {Platform.OS} device supports {supportedLocales.locales.length}{" "}
          locales ({supportedLocales.installedLocales.length} installed)
        </Text>

        <ScrollView contentContainerStyle={[styles.row, styles.flexWrap]}>
          {locales.map((locale) => {
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
                onPress={() =>
                  handleChange(
                    "lang",
                    settings.lang === locale ? undefined : locale,
                  )
                }
              />
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const fallbackLocales = [
  "cmn-Hans-CN",
  "cmn-Hant-TW",
  "de-AT",
  "de-BE",
  "de-CH",
  "de-DE",
  "en-AU",
  "en-CA",
  "en-GB",
  "en-IE",
  "en-IN",
  "en-SG",
  "en-US",
  "es-ES",
  "es-US",
  "fr-BE",
  "fr-CA",
  "fr-CH",
  "fr-FR",
  "hi-IN",
  "id-ID",
  "it-CH",
  "it-IT",
  "ja-JP",
  "ko-KR",
  "pl-PL",
  "pt-BR",
  "ru-RU",
  "th-TH",
  "tr-TR",
  "vi-VN",
];

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
  const defaultRecognitionService =
    ExpoSpeechRecognitionModule.getDefaultRecognitionService().packageName;
  const assistantService =
    ExpoSpeechRecognitionModule.getAssistantService().packageName;
  return (
    <View style={styles.gap1}>
      <View>
        <View style={[styles.card, styles.mb2]}>
          <View style={styles.gap1}>
            <Text style={styles.textLabel}>Device preferences</Text>
            {defaultRecognitionService ? (
              <Text style={styles.textSubtle}>
                Default Recognition Service: {defaultRecognitionService}
              </Text>
            ) : null}
            {assistantService ? (
              <Text style={styles.textSubtle}>
                Assistant Service: {assistantService}
              </Text>
            ) : null}
          </View>
        </View>

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
              {["free_form", "web_search"].map((model) => (
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
                  [key]: !settings.androidIntentOptions?.[key],
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

  useSpeechRecognitionEvent("audiostart", (event) => {
    // Note: don't use this file until the "audioend" event is emitted
    // Note: event.uri will be null if `recordingOptions.persist` is not enabled
    console.log("Recording started for file:", event.uri);
  });

  useSpeechRecognitionEvent("audioend", (event) => {
    // Recording ended, the file is now safe to use
    console.log("Local file path:", event.uri);
    // Android: Will be saved as a .wav file
    // e.g. "file:///data/user/0/expo.modules.speechrecognition.example/cache/recording_1720678500903.wav"
    // iOS: Will be saved as a .caf file
    // e.g. "file:///path/to/Library/Caches/audio_CD5E6C6C-3D9D-4754-9188-D6FAF97D9DF2.caf"
    setRecordingPath(event.uri);
  });

  // Enable audio recording
  return (
    <View style={styles.gap1}>
      <View style={[styles.row, styles.gap1, styles.flexWrap]}>
        <BigButton
          title="Get permissions"
          color="#7C90DB"
          onPress={() => {
            ExpoSpeechRecognitionModule.getPermissionsAsync().then((result) => {
              Alert.alert("Get Permissions result", JSON.stringify(result));
            });
          }}
        />
        <BigButton
          title="Request permissions"
          color="#7C90DB"
          onPress={() => {
            ExpoSpeechRecognitionModule.requestPermissionsAsync().then(
              (result) => {
                Alert.alert(
                  "RequestPermissions result",
                  JSON.stringify(result),
                );
              },
            );
          }}
        />
        <BigButton
          title="Get microphone permissions"
          color="#7C90DB"
          onPress={() => {
            ExpoSpeechRecognitionModule.getMicrophonePermissionsAsync().then(
              (result) => {
                Alert.alert("Result", JSON.stringify(result));
              },
            );
          }}
        />
        <BigButton
          title="Request microphone permissions"
          color="#7C90DB"
          onPress={() => {
            ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync().then(
              (result) => {
                Alert.alert("Result", JSON.stringify(result));
              },
            );
          }}
        />
        <BigButton
          title="Get speech recognizer permissions"
          color="#7C90DB"
          onPress={() => {
            ExpoSpeechRecognitionModule.getSpeechRecognizerPermissionsAsync().then(
              (result) => {
                Alert.alert("Result", JSON.stringify(result));
              },
            );
          }}
        />
        <BigButton
          title="Request speech recognizer permissions"
          color="#7C90DB"
          onPress={() => {
            ExpoSpeechRecognitionModule.requestSpeechRecognizerPermissionsAsync().then(
              (result) => {
                Alert.alert("Result", JSON.stringify(result));
              },
            );
          }}
        />
        <BigButton
          title="Get speech recognizer state"
          color="#7C90DB"
          onPress={() => {
            ExpoSpeechRecognitionModule.getStateAsync().then((state) => {
              console.log("Current state:", state);
              Alert.alert("Current state", state);
            });
          }}
        />
        <BigButton
          title="Call isRecognitionAvailable()"
          color="#7C90DB"
          onPress={() => {
            const isAvailable =
              ExpoSpeechRecognitionModule.isRecognitionAvailable();
            Alert.alert("isRecognitionAvailable()", isAvailable.toString());
          }}
        />
        {Platform.OS === "ios" && (
          <BigButton
            title="Set audio session active state"
            color="#7C90DB"
            onPress={() => {
              ExpoSpeechRecognitionModule.setAudioSessionActiveIOS(true, {
                notifyOthersOnDeactivation: false,
              });
            }}
          />
        )}
      </View>
      <CheckboxButton
        title="Persist audio recording to filesystem"
        checked={Boolean(settings.recordingOptions?.persist)}
        onPress={() =>
          handleChange("recordingOptions", {
            persist: !settings.recordingOptions?.persist,
            outputDirectory: FileSystem.documentDirectory ?? undefined,
            outputFileName: "recording.wav",
            // for iOS if you'd like to downsample the audio, set the outputSampleRate + outputEncoding
            outputSampleRate: 16000,
            outputEncoding: "pcmFormatInt16",
          })
        }
      />
      {settings.recordingOptions?.persist ? (
        <View
          style={{
            borderStyle: "dashed",
            borderWidth: 2,
            padding: 10,
            minHeight: 100,
            flex: 1,
          }}
        >
          {recordingPath ? (
            <View>
              <Text style={styles.text}>
                Audio recording saved to {recordingPath}
              </Text>
              <AudioPlayer source={recordingPath} />
              <BigButton
                title="Transcribe the recording"
                color="#539bf5"
                onPress={() => {
                  ExpoSpeechRecognitionModule.start({
                    lang: "en-US",
                    interimResults: true,
                    audioSource: {
                      uri: recordingPath,
                      audioChannels: 1,
                      audioEncoding: AudioEncodingAndroid.ENCODING_PCM_16BIT,
                      sampleRate: 16000,
                    },
                  });
                }}
              />
            </View>
          ) : (
            <Text style={styles.text}>
              Waiting for speech recognition to end...
            </Text>
          )}
        </View>
      ) : null}

      <WebSpeechAPIDemo />

      <RecordUsingExpoAvDemo />

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
        description="16000hz MP3 1-channel audio file"
      />

      <TranscribeRemoteAudioFile
        fileName="remote-en-us-sentence-16000hz.ogg"
        remoteUrl="https://github.com/jamsch/expo-speech-recognition/raw/main/example/assets/audio-remote/remote-en-us-sentence-16000hz.ogg"
        audioEncoding={AudioEncodingAndroid.ENCODING_OPUS}
        description="(May not work on iOS) 16000hz ogg vorbis 1-channel audio file"
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
    Audio.Sound.createAsync({ uri: props.source }, { shouldPlay: true }).catch(
      (reason) => {
        console.log("Failed to play audio", reason);
      },
    );
  };

  return <Button title="Play back recording" onPress={handlePlay} />;
}

function WebSpeechAPIDemo() {
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
    <View style={styles.card}>
      {!listening ? (
        <BigButton
          color="#53917E"
          title="Start Recognition (Web Speech API)"
          onPress={startListeningWeb}
        />
      ) : (
        <View style={[styles.row, styles.gap1]}>
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

      <Text style={styles.text}>Errors: {JSON.stringify(error)}</Text>

      <ScrollView>
        <Text style={styles.text}>
          {transcription?.transcript || "Transcripts goes here"}
        </Text>
      </ScrollView>
    </View>
  );
}

function RecordUsingExpoAvDemo() {
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);

  const handleStart = async () => {
    setIsRecording(true);
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync({
        isMeteringEnabled: true,
        android: {
          bitRate: 32000,
          extension: ".m4a",
          outputFormat: AndroidOutputFormat.MPEG_4,
          audioEncoder: AndroidAudioEncoder.AAC,
          numberOfChannels: 1,
          sampleRate: 16000,
        },
        ios: {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
          numberOfChannels: 1,
          bitRate: 16000,
          extension: ".wav",
          outputFormat: IOSOutputFormat.LINEARPCM,
        },
        web: {
          mimeType: "audio/wav",
          bitsPerSecond: 128000,
        },
      });

      recordingRef.current = recording;
    } catch (e) {
      console.log("Error starting recording", e);
    }
  };

  const handleStop = async () => {
    setIsRecording(false);
    const recording = recordingRef.current;
    if (!recording) {
      return;
    }
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecordingUri(uri);
  };

  return (
    <View style={styles.card}>
      <Text style={[styles.text, styles.mb2]}>Record using Expo AV</Text>

      <View style={styles.row}>
        {!isRecording ? (
          <BigButton
            title="Start Recording"
            color="#539bf5"
            onPress={handleStart}
          />
        ) : (
          <BigButton
            title="Stop Recording"
            color="#7C90DB"
            onPress={handleStop}
          />
        )}
      </View>

      {recordingUri && <AudioPlayer source={recordingUri} />}

      {recordingUri && (
        <BigButton
          title="Transcribe the recording"
          color="#539bf5"
          onPress={() => {
            console.log("Transcribing recording", recordingUri);
            ExpoSpeechRecognitionModule.start({
              lang: "en-US",
              interimResults: true,
              // Switch to true for faster transcription
              // (Make sure you downloaded the offline model first)
              requiresOnDeviceRecognition: false,
              audioSource: {
                uri: recordingUri,
                audioChannels: 1,
                audioEncoding: AudioEncodingAndroid.ENCODING_MP3,
                sampleRate: 16000,
              },
            });
          }}
        />
      )}
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
  textSubtle: {
    fontSize: 10,
    color: "#999",
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
