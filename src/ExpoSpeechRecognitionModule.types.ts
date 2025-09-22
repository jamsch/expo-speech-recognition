import type { PermissionResponse } from "expo-modules-core";
import type { NativeModule } from "expo";

export type ExpoSpeechRecognitionPermissionResponse = PermissionResponse & {
  /**
   * Whether the speech recognition is restricted by Content & Privacy Restrictions.
   *
   * This value corresponds to the `restricted` enum of `SFSpeechRecognizer.authorizationStatus()`.
   *
   * This is only available on iOS.
   */
  restricted?: boolean;
};

import type {
  AudioEncodingAndroid,
  AVAudioSessionCategory,
  AVAudioSessionCategoryOptions,
  AVAudioSessionMode,
  RecognizerIntentEnableLanguageSwitch,
  RecognizerIntentExtraLanguageModel,
  TaskHintIOS,
} from "./constants";

export type AVAudioSessionCategoryValue =
  (typeof AVAudioSessionCategory)[keyof typeof AVAudioSessionCategory];

export type ExpoSpeechRecognitionResult = {
  transcript: string;
  /**
   * Value ranging between between 0.0, 1.0, and -1 (unavailable) indicating transcript confidence.
   */
  confidence: number;
  /**
   * An array of transcription segments that represent the parts of the transcription, as identified by the speech recognizer.
   *
   * Notes for Android:
   *
   * - This is only available for SDK 34+ (Android 14+)
   * - This is only verified to work with the `com.google.android.as` service (using on device speech recognition)
   * - Segments are only available during the final result
   * - The segment parts are split up by words.
   * - The segments are only available for the first transcript
   * - Segment confidences currently return as -1 (unavailable)
   *
   * Notes for iOS:
   *
   * - The confidence value will be 0 on partial results
   */
  segments: ExpoSpeechRecognitionResultSegment[];
};

export type ExpoSpeechRecognitionResultSegment = {
  /** The start timestamp of the utterance, e.g. 1000 */
  startTimeMillis: number;
  /** The end timestamp of the utterance, e.g. 1500 */
  endTimeMillis: number;
  /** The text portion of the transcript, e.g. "Hello world" */
  segment: string;
  /** Value ranging between between 0.0, 1.0, and -1 (unavailable) indicating the confidence of the specific segment */
  confidence: number;
};

/** Fired when there's a speech result. The result may be partial or final */
export type ExpoSpeechRecognitionResultEvent = {
  isFinal: boolean;
  results: ExpoSpeechRecognitionResult[];
};

export type ExpoSpeechRecognitionErrorCode =
  /** The user called `ExpoSpeechRecognitionModule.abort()`. */
  | "aborted"
  /** Audio recording error. */
  | "audio-capture"
  /** There was an error in the speech recognition grammar or semantic tags, or the chosen grammar format or semantic tag format was unsupported. */
  | "bad-grammar"
  /** Locale is not supported by the speech recognizer. */
  | "language-not-supported"
  /** Network communication required for completing the recognition failed. */
  | "network"
  /** No final speech was detected. */
  | "no-speech"
  /** Permission to use speech recognition or microphone was not granted. */
  | "not-allowed"
  /** Recognizer is unavailable. */
  | "service-not-allowed"
  // Extra codes (not part of the spec)
  /** The recognizer is busy and cannot accept any new recognition requests. */
  | "busy"
  /** (Android only) An unknown client-side error occurred. */
  | "client"
  /** (Android) No speech input. */
  | "speech-timeout"
  /** (Android) Unknown error */
  | "unknown";

export type ExpoSpeechRecognitionErrorEvent = {
  error: ExpoSpeechRecognitionErrorCode;
  message: string;
  /**
   * The underlying native error code from the platform-specific speech recognition service.
   *
   * - On Android: Maps to SpeechRecognizer error constants (e.g., ERROR_AUDIO = 3)
   * - Value of -1 indicates a generic/unknown error or when native code is not available
   *
   * Usually you won't need this field, but it can be useful for debugging purposes.
   */
  code?: number;
};

export type LanguageDetectionEvent = {
  /** The language that was detected, in BCP-47 format. e.g. "en-US", "de-DE" */
  detectedLanguage: string;
  /** The confidence of the detected language. A value ranging between 0.0 and 1.0.
   *
   * Values range from:
   *
   * - 1.0 (highly confident)
   * - 0.8 (confident)
   * - 0.5 (not confident)
   * - 0.0 (unknown)
   */
  confidence: number;
  /** The alternative locales for the same language, in BCP-47 format. e.g. ["en-US", "en-GB"] */
  topLocaleAlternatives: string[];
};

/**
 * Events that are dispatched from the native side
 */
export type ExpoSpeechRecognitionNativeEventMap = {
  result: ExpoSpeechRecognitionResultEvent;
  error: ExpoSpeechRecognitionErrorEvent;
  start: null;
  speechstart: null;
  speechend: null;
  /** A final result is returned with no significant recognition */
  nomatch: null;
  /** Audio capturing had started */
  audiostart: {
    /**
     * The uri is set when `recordingOptions.persist` is enabled.
     * Do not attempt to use this file until the `audioend` event is emitted.
     *
     * Example URIs:
     *
     * - Android: `file:///data/user/0/expo.modules.speechrecognition.example/cache/recording_1720678500903.wav`
     * - iOS: `file:///path/to/Library/Caches/audio_CD5E6C6C-3D9D-4754-9188-D6FAF97D9DF2.wav`
     */
    uri: string | null;
  };
  /** Audio capturing had ended */
  audioend: {
    /**
     * The uri is set when `recordingOptions.persist` is enabled.
     *
     * Example URIs:
     *
     * - Android: `file:///data/user/0/expo.modules.speechrecognition.example/cache/recording_1720678500903.wav`
     * - iOS: `file:///path/to/Library/Caches/audio_CD5E6C6C-3D9D-4754-9188-D6FAF97D9DF2.wav`
     */
    uri: string | null;
  };
  end: null;
  soundstart: null;
  soundend: null;
  languagedetection: LanguageDetectionEvent;
  volumechange: {
    /**
     * A float value between -2 and 10 indicating the volume of the input audio
     *
     * Consider anything below 0 to be inaudible
     */
    value: number;
  };
};

export type ExpoSpeechRecognitionOptions = {
  /** [Default: "en-US"] The language of the speech recognition */
  lang?: string;
  /** [Default: false] Note for iOS: final results are only available after speech recognition has stopped */
  interimResults?: boolean;
  /** [Default: 5] The maximum number of alternative transcriptions to return. */
  maxAlternatives?: number;
  /**
   * An array of strings that will be used to provide context to the speech recognition engine.
   *
   * On Android, this configures [`EXTRA_BIASING_STRINGS`](https://developer.android.com/reference/android/speech/RecognizerIntent#EXTRA_BIASING_STRINGS) in the recognizer intent (API level 33+).
   *
   * On iOS, this configures [`SFSpeechRecognitionRequest.contextualStrings`](https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/1649391-contextualstrings).
   */
  contextualStrings?: string[];
  /**
   * [Default: false] Continuous recognition.
   *
   * Not supported on Android 12 and below.
   *
   * If false, the behaviors are the following:
   *
   *   - on iOS 17-, recognition will run until no speech is detected for 3 seconds.
   *   - on iOS 18+ and Android, recognition will run until a result with `isFinal: true` is received.
   */
  continuous?: boolean;
  /** [Default: false] Prevent device from sending audio over the network. Only enabled if the device supports it.
   *
   * Use `getSupportedLocales()` to verify if the locale is installed on the device prior to enabling this option.
   */
  requiresOnDeviceRecognition?: boolean;
  /**
   * [Default: false] Include punctuation in the recognition results. This applies to full stops and commas.
   *
   * On Android, this configures [`EXTRA_ENABLE_FORMATTING`](https://developer.android.com/reference/android/speech/RecognizerIntent#EXTRA_ENABLE_FORMATTING) in the recognizer intent (Android 13+, API level 33+).
   *
   * Note for Android: This feature is only verified to work on Android 13+ with on-device speech recognition enabled (i.e. enabling `requiresOnDeviceRecognition` or using the `com.google.android.as` service package)
   *
   * On iOS, this configures [`SFSpeechRecognitionRequest.addsPunctuation`](https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/3930023-addspunctuation).
   */
  addsPunctuation?: boolean;
  /**
   * The package name of the speech recognition service to use.
   * If not provided, the default service will be used.
   *
   * Obtain the supported packages by running `ExpoSpeechRecognitionModule.getSpeechRecognitionServices()`
   *
   * e.g. "com.google.android.as" or "com.samsung.android.bixby.agent"
   */
  androidRecognitionServicePackage?: string;
  /**
   * Extra options to provide to the Android Recognition intent.
   *
   * For a full list of options, see https://developer.android.com/reference/android/speech/RecognizerIntent
   */
  androidIntentOptions?: Partial<AndroidIntentOptions>;
  /**
   * Audio source options to pass to the recognizer.
   *
   * This option can be used to recognize audio from a local or remote file URI.
   */
  audioSource?: AudioSourceOptions;
  /**
   * Audio recording options for persisting the audio to a local file path.
   */
  recordingOptions?: RecordingOptions;
  /**
   * Default: `"android.speech.action.RECOGNIZE_SPEECH"`
   *
   * The kind of intent action
   *
   * Intents:
   *
   * - [`android.speech.action.RECOGNIZE_SPEECH`](https://developer.android.com/reference/android/speech/RecognizerIntent#ACTION_RECOGNIZE_SPEECH) which performs speech recognition (default)
   * - [`android.speech.action.VOICE_SEARCH_HANDS_FREE`](https://developer.android.com/reference/android/speech/RecognizerIntent#ACTION_VOICE_SEARCH_HANDS_FREE) - prompts the user for speech without requiring the user's visual attention or touch input
   * - [`android.speech.action.WEB_SEARCH`](https://developer.android.com/reference/android/speech/RecognizerIntent#ACTION_WEB_SEARCH) - displays a web search result or trigger another type of action based on the user's speech.
   */
  androidIntent?:
    | "android.speech.action.RECOGNIZE_SPEECH"
    | "android.speech.action.VOICE_SEARCH_HANDS_FREE"
    | "android.speech.action.WEB_SEARCH";

  /**
   * The hint for the speech recognition task.
   *
   * Default: `"unspecified"`
   *
   * Docs: https://developer.apple.com/documentation/speech/sfspeechrecognitiontaskhint
   */
  iosTaskHint?: IOSTaskHintValue;

  /**
   * The audio category for the speech recognition task.
   *
   * Use this option to configure the default audio session category and mode prior to starting speech recognition.
   *
   * **Caution:** confirm that the category, options and mode are compatible with the audio source.
   *
   * By default, the audio session category and mode are set to:
   *
   * - category: `playAndRecord`
   * - options: `defaultToSpeaker` and `allowBluetooth`
   * - mode: `measurement`
   *
   * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/category
   */
  iosCategory?: SetCategoryOptions;

  /**
   * Settings for volume change events.
   */
  volumeChangeEventOptions?: {
    /**
     * Whether to emit volume change events.
     *
     * Default: false
     */
    enabled?: boolean;
    /**
     * Specifies the interval (in milliseconds) to emit `volumechange` events.
     *
     * Default: 100ms on iOS
     *
     * Increasing this value will improve performance
     */
    intervalMillis?: number;
  };

  /**
   * [iOS only] Enabling this option will prevent microphone feedback.
   *
   * When enabled, extra signal processing is applied on the incoming audio, and any audio that is coming from the device is taken out.
   *
   * Note: this setting may switch the AVAudioSession mode to "voiceChat" and lower the volume of speaker playback
   *
   * (This option will place both input and output nodes in voice processing mode as noted in Apple docs: http://developer.apple.com/videos/play/wwdc2019/510/?time=66)
   */
  iosVoiceProcessingEnabled?: boolean;
};

export type IOSTaskHintValue = (typeof TaskHintIOS)[keyof typeof TaskHintIOS];

export type RecordingOptions = {
  /**
   * Whether to persist the audio to a local file path.
   *
   * Default: false
   */
  persist: boolean;
  /**
   * Default: `FileSystem.CacheDirectory`. This changes the default storage location for the audio file.
   */
  outputDirectory?: string;
  /**
   * Default: `"recording_${timestamp|uuid}.[wav|caf]"`. This changes the file name for the audio file.
   */
  outputFileName?: string;
  /**
   * Default: undefined. The sample rate of the output audio file.
   *
   * Only supported on iOS
   *
   * Default sample rate is: 16000 on Android, 44100/48000 on iOS
   */
  outputSampleRate?: number;
  /**
   * Default: undefined. The encoding of the output audio file.
   *
   * Only supported on iOS
   */
  outputEncoding?:
    | "pcmFormatFloat32"
    | "pcmFormatFloat64"
    | "pcmFormatInt16"
    | "pcmFormatInt32";
};

export type AudioSourceOptions = {
  /**
   * Local audio source URI.
   *
   * e.g. `"file:///storage/emulated/0/Download/audio.wav"`
   */
  uri: string;
  /**
   * [Android only] The number of channels in the source audio.
   *
   * Default: 1
   */
  audioChannels?: number;
  /**
   * [Android only] A value from [AudioFormat](https://developer.android.com/reference/android/media/AudioFormat).
   *
   * Use the `AudioEncodingAndroid` enum to get the correct value.
   */
  audioEncoding?: AudioEncodingAndroidValue;
  /**
   * [Android only] Audio sampling rate in Hz.
   *
   * Default: 16000
   */
  sampleRate?: number;
  /**
   * [Android only] The delay for a 4KiB chunk of audio to stream to the speech recognition service.
   *
   * Use this setting to avoid being rate-limited when using network-based recognition.
   *
   * If you're using on-device recognition, you may want to increase this value to avoid unprocessed audio chunks.
   *
   * Default: 50ms for network-based recognition, 15ms for on-device recognition
   */
  chunkDelayMillis?: number;
};

export type AudioEncodingAndroidValue =
  (typeof AudioEncodingAndroid)[keyof typeof AudioEncodingAndroid];

export type AndroidIntentOptions = {
  /**
   * https://developer.android.com/reference/android/speech/RecognizerIntent#EXTRA_CALLING_PACKAGE
   *
   * The extra key used in an intent to the speech recognizer for voice search. Not generally to be used by developers. The system search dialog uses this, for example, to set a calling package for identification by a voice search API. If this extra is set by anyone but the system process, it should be overridden by the voice search implementation.
   */
  EXTRA_CALLING_PACKAGE: string;
  /**
   * https://developer.android.com/reference/android/speech/RecognizerIntent#EXTRA_ENABLE_BIASING_DEVICE_CONTEXT
   *
   * Optional boolean to enable biasing towards device context. The recognizer will use the device context to tune the recognition results.
   *
   * Depending on the recognizer implementation, this value may have no effect.
   */
  EXTRA_ENABLE_BIASING_DEVICE_CONTEXT: boolean;
  /**
   * https://developer.android.com/reference/android/speech/RecognizerIntent#EXTRA_ENABLE_LANGUAGE_DETECTION
   *
   * Optional boolean indicating whether to enable language detection. When enabled, the recognizer will consistently identify the language of the current spoken utterance and provide that info via RecognitionListener#onLanguageDetection(Bundle).
   */
  EXTRA_ENABLE_LANGUAGE_DETECTION: boolean;
  /**
   * https://developer.android.com/reference/android/speech/RecognizerIntent#EXTRA_ENABLE_LANGUAGE_SWITCH
   *
   * Optional string to enable automatic switching to the language being spoken with the desired sensitivity level, instead of being restricted to a single language. The corresponding language models must be downloaded to support the switch. Otherwise, the recognizer will report an error on a switch failure. The recognizer provides the switch results via RecognitionListener#onLanguageDetection(Bundle).
   *
   * Since detection is a necessary requirement for the language switching, setting this value implicitly enables EXTRA_ENABLE_LANGUAGE_DETECTION.
   *
   * Depending on the recognizer implementation, this value may have no effect.
   */
  EXTRA_ENABLE_LANGUAGE_SWITCH: (typeof RecognizerIntentEnableLanguageSwitch)[keyof typeof RecognizerIntentEnableLanguageSwitch];
  /**
   * https://developer.android.com/reference/android/speech/RecognizerIntent#EXTRA_ENABLE_FORMATTING
   *
   * NOTE: This is also configurable through `addsPunctuation` (which sets `EXTRA_ENABLE_FORMATTING` to "quality")
   *
   * [API level 33] Optional string to enable text formatting (e.g. unspoken punctuation (examples: question mark, comma, period, etc.), capitalization, etc.) and specify the optimization strategy. If set, the partial and final result texts will be formatted. Each result list will contain two hypotheses in the order of 1) formatted text 2) raw text.
   *
   */
  EXTRA_ENABLE_FORMATTING: "latency" | "quality";
  /**
   * https://developer.android.com/reference/android/speech/RecognizerIntent#EXTRA_HIDE_PARTIAL_TRAILING_PUNCTUATION
   *
   * [API level 33] Optional boolean, to be used with EXTRA_ENABLE_FORMATTING, to prevent the recognizer adding punctuation after the last word of the partial results. The default is false.
   */
  EXTRA_HIDE_PARTIAL_TRAILING_PUNCTUATION: boolean;
  /**
   * Optional list of IETF language tags (as defined by BCP 47, e.g. "en-US", "de-DE").
   *
   * [API level 34] This extra is to be used with EXTRA_ENABLE_LANGUAGE_DETECTION. If set, the recognizer will constrain the language detection output to this list of languages, potentially improving detection accuracy.
   */
  EXTRA_LANGUAGE_DETECTION_ALLOWED_LANGUAGES: string[];
  /**
   * https://developer.android.com/reference/android/speech/RecognizerIntent#EXTRA_LANGUAGE_MODEL
   *
   * [Default: free_form] The language model to use for speech recognition.
   *
   * Informs the recognizer which speech model to prefer when performing ACTION_RECOGNIZE_SPEECH.
   * The recognizer uses this information to fine tune the results.
   * This extra is required. Activities implementing ACTION_RECOGNIZE_SPEECH may interpret the values as they see fit.
   */
  EXTRA_LANGUAGE_MODEL: (typeof RecognizerIntentExtraLanguageModel)[keyof typeof RecognizerIntentExtraLanguageModel];

  /**
   * https://developer.android.com/reference/android/speech/RecognizerIntent#EXTRA_LANGUAGE_SWITCH_ALLOWED_LANGUAGES
   *
   * [API level 34] Optional list of IETF language tags (as defined by BCP 47, e.g. "en-US", "de-DE").
   * This extra is to be used with EXTRA_ENABLE_LANGUAGE_SWITCH. If set, the recognizer will apply the auto switch only to these languages, even if the speech models of other languages also exist.
   * The corresponding language models must be downloaded to support the switch. Otherwise, the recognizer will report an error on a switch failure.
   */
  EXTRA_LANGUAGE_SWITCH_ALLOWED_LANGUAGES: string[];
  /**
   * https://developer.android.com/reference/android/speech/RecognizerIntent#EXTRA_LANGUAGE_SWITCH_INITIAL_ACTIVE_DURATION_TIME_MILLIS
   *
   * [API level 35] Optional integer to use for EXTRA_ENABLE_LANGUAGE_SWITCH. If set, the language switch will only be activated for this value of ms of audio since the START_OF_SPEECH. This could provide a more stable recognition result when the language switch is only required in the beginning of the session.
   */
  EXTRA_LANGUAGE_SWITCH_INITIAL_ACTIVE_DURATION_TIME_MILLIS: number;
  /**
   * https://developer.android.com/reference/android/speech/RecognizerIntent#EXTRA_LANGUAGE_SWITCH_MAX_SWITCHES
   *
   * [API level 35] Optional integer to use for EXTRA_ENABLE_LANGUAGE_SWITCH. If set, the language switch will be deactivated when LANGUAGE_SWITCH_MAX_SWITCHES reached.
   *
   * Depending on the recognizer implementation, this flag may have no effect.
   */
  EXTRA_LANGUAGE_SWITCH_MAX_SWITCHES: number;
  /**
   * https://developer.android.com/reference/android/speech/RecognizerIntent#EXTRA_MASK_OFFENSIVE_WORDS
   *
   * [API level 33] Optional boolean indicating whether the recognizer should mask the offensive words in recognition results. The Default is true.
   *
   * Constant Value: "android.speech.extra.MASK_OFFENSIVE_WORDS"
   */
  EXTRA_MASK_OFFENSIVE_WORDS: boolean;
  /**
   * https://developer.android.com/reference/android/speech/RecognizerIntent#EXTRA_ORIGIN
   *
   * Optional value which can be used to indicate the referer url of a page in which speech was requested. For example, a web browser may choose to provide this for uses of speech on a given page.
   */
  EXTRA_ORIGIN: string;
  /**
   * https://developer.android.com/reference/android/speech/RecognizerIntent#EXTRA_PREFER_OFFLINE
   *
   * Optional boolean, to be used with ACTION_RECOGNIZE_SPEECH, ACTION_VOICE_SEARCH_HANDS_FREE, ACTION_WEB_SEARCH to indicate whether to only use an offline speech recognition engine. The default is false, meaning that either network or offline recognition engines may be used.
   *
   * Depending on the recognizer implementation, these values may have no effect.
   */
  EXTRA_PREFER_OFFLINE: boolean;
  /**
   * https://developer.android.com/reference/android/speech/RecognizerIntent#EXTRA_PROMPT
   *
   * Optional text prompt to show to the user when asking them to speak.
   */
  EXTRA_PROMPT: string;
  /**
   * https://developer.android.com/reference/android/speech/RecognizerIntent#EXTRA_REQUEST_WORD_CONFIDENCE
   *
   * [API level 34] Optional boolean indicating whether the recognizer should return the confidence level of each word in the final recognition results.
   */
  EXTRA_REQUEST_WORD_CONFIDENCE: boolean;
  /**
   * https://developer.android.com/reference/android/speech/RecognizerIntent#EXTRA_REQUEST_WORD_TIMING
   *
   * [API level 34] Optional boolean indicating whether the recognizer should return the timestamp of each word in the final recognition results.
   */
  EXTRA_REQUEST_WORD_TIMING: boolean;
  /**
   * https://developer.android.com/reference/android/speech/RecognizerIntent#EXTRA_SECURE
   *
   * Optional boolean to indicate that a "hands free" voice search was performed while the device was in a secure mode. An example of secure mode is when the device's screen lock is active, and it requires some form of authentication to be unlocked. When the device is securely locked, the voice search activity should either restrict the set of voice actions that are permitted, or require some form of secure authentication before proceeding.
   */
  EXTRA_SECURE: boolean;
  /**
   * Optional string to enable segmented session mode of the specified type,
   * which can be `EXTRA_AUDIO_SOURCE`, `EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS` or `EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS`.
   * When segmented session mode is supported by the recognizer implementation and this extra is set,
   * it will return the recognition results in segments via [RecognitionListener#onSegmentResults(Bundle)](https://developer.android.com/reference/android/speech/RecognitionListener#onSegmentResults(android.os.Bundle))
   * and terminate the session with [RecognitionListener#onEndOfSegmentedSession()](https://developer.android.com/reference/android/speech/RecognitionListener#onEndOfSegmentedSession()).
   *
   * When setting this extra, make sure the extra used as the string value here is also set in the same intent with proper value.
   *
   * Depending on the recognizer implementation, this value may have no effect.
   */
  EXTRA_SEGMENTED_SESSION:
    | "android.speech.extra.AUDIO_SOURCE"
    | "android.speech.extras.SPEECH_INPUT_MINIMUM_LENGTH_MILLIS"
    | "android.speech.extras.SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS";
  /**
   * https://developer.android.com/reference/android/speech/RecognizerIntent#EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS
   *
   * The amount of time that it should take after the recognizer stops hearing speech to consider the input complete hence end the recognition session.
   *
   * Note that it is extremely rare you'd want to specify this value in an intent. Generally, it should be specified only when it is also used as the value for EXTRA_SEGMENTED_SESSION to enable segmented session mode. Note also that certain values may cause undesired or unexpected results - use judiciously!
   *
   * Depending on the recognizer implementation, these values may have no effect.
   *
   */
  EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: number;
  /**
   * https://developer.android.com/reference/android/speech/RecognizerIntent#EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS
   *
   * Optional integer to indicate the minimum length of the recognition session. The recognizer will not stop recognizing speech before this amount of time.
   *
   * Note that it is extremely rare you'd want to specify this value in an intent. Generally, it should be specified only when it is also used as the value for EXTRA_SEGMENTED_SESSION to enable segmented session mode. Note also that certain values may cause undesired or unexpected results - use judiciously!
   *
   * Depending on the recognizer implementation, these values may have no effect.
   */
  EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: number;
  /**
   * https://developer.android.com/reference/android/speech/RecognizerIntent#EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS
   *
   * The amount of time that it should take after we stop hearing speech to consider the input possibly complete.
   * This is used to prevent the endpointer cutting off during very short mid-speech pauses.
   * Note that it is extremely rare you'd want to specify this value in an intent.
   * If you don't have a very good reason to change these, you should leave them as they are.
   * Note also that certain values may cause undesired or unexpected results - use judiciously!
   * Additionally, depending on the recognizer implementation, these values may have no effect.
   */
  EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: number;
};

export type ExpoSpeechRecognitionNativeEvents = {
  [K in keyof ExpoSpeechRecognitionNativeEventMap]: (
    event: ExpoSpeechRecognitionNativeEventMap[K],
  ) => void;
};

export declare class ExpoSpeechRecognitionModuleType extends NativeModule<ExpoSpeechRecognitionNativeEvents> {
  /**
   * Starts speech recognition.
   */
  start(options: ExpoSpeechRecognitionOptions): void;
  /**
   * Stops speech recognition and attempts to return a final result (through the `result` event).
   */
  stop(): void;
  /**
   * Cancels speech recognition immediately without returning a final result.
   */
  abort(): void;
  /**
   * Presents a dialog to the user to request permissions for using speech recognition and the microphone.
   *
   * For Android, this will request RECORD_AUDIO permission.
   *
   * For iOS, this will request microphone and speech recognition permissions.
   * Once a user has granted (or denied) permissions by responding to the original permission request dialog,
   * the only way that the permissions can be changed is by the user themselves using the device settings app.
   */
  requestPermissionsAsync(): Promise<ExpoSpeechRecognitionPermissionResponse>;
  /**
   * Returns the current permission status for speech recognition and the microphone.
   *
   * You may also use `getMicrophonePermissionsAsync` and `getSpeechRecognizerPermissionsAsync` to get the permissions separately.
   */
  getPermissionsAsync(): Promise<ExpoSpeechRecognitionPermissionResponse>;
  /**
   * Returns the current permission status for the microphone.
   */
  getMicrophonePermissionsAsync(): Promise<PermissionResponse>;
  /**
   * Presents a dialog to the user to request permissions for using the microphone.
   *
   * For iOS, once a user has granted (or denied) permissions by responding to the original permission request dialog,
   * the only way that the permissions can be changed is by the user themselves using the device settings app.
   */
  requestMicrophonePermissionsAsync(): Promise<PermissionResponse>;
  /**
   * Returns the current permission status for speech recognition.
   */
  getSpeechRecognizerPermissionsAsync(): Promise<ExpoSpeechRecognitionPermissionResponse>;
  /**
   * [iOS only] Presents a dialog to the user to request permissions for using the speech recognizer.
   * This permission is required when `requiresOnDeviceRecognition` is disabled (i.e. network-based recognition)
   *
   * For iOS, once a user has granted (or denied) permissions by responding to the original permission request dialog,
   * the only way that the permissions can be changed is by the user themselves using the device settings app.
   */
  requestSpeechRecognizerPermissionsAsync(): Promise<ExpoSpeechRecognitionPermissionResponse>;
  /**
   * Returns an array of locales supported by the speech recognizer.
   *
   * Not supported on Android 12 and below (API level 31), this will return an empty array of locales.
   *
   * @throws {"package_not_found"} If the service package is not found.
   * @throws {"error_[number]"} If there was an error retrieving the supported locales.
   */
  getSupportedLocales(options: {
    /**
     * The package name of the speech recognition service to use.
     *
     * e.g. "com.google.android.as" or "com.samsung.android.bixby.agent"
     *
     * Warning: the service package (such as Bixby) may not be able to return any results.
     */
    androidRecognitionServicePackage?: string;
  }): Promise<{
    /**
     * All supported languages on the device. This includes both installed and supported languages.
     */
    locales: string[];
    /**
     * These languages are installed on to the device for offline use.
     *
     * This will likely be an empty array if the service package is not "com.google.android.as"
     */
    installedLocales: string[];
  }>;
  /**
   * [Android only] Returns an array of package names of speech recognition services that are available on the device.
   *
   * List of all available services as bundle identifiers, e.g. ["com.google.android.as", "com.google.android.tts"]
   */
  getSpeechRecognitionServices(): string[];
  /**
   * [Android only] Returns the default voice recognition service on the device.
   *
   * @returns empty string if no service is found, or not Android
   */
  getDefaultRecognitionService(): {
    /** e.g. "com.google.android.tts" or "com.google.android.googlequicksearchbox" */
    packageName: string;
  };
  /**
   * [Android only] Returns the default voice recognition service on the device.
   *
   * e.g. "com.google.android.googlequicksearchbox" or "com.samsung.android.bixby.agent"
   *
   * @returns empty string if no service is found, or not Android
   */
  getAssistantService(): {
    /** e.g. "com.google.android.googlequicksearchbox" or "com.samsung.android.bixby.agent" */
    packageName: string;
  };
  /**
   * Whether the on-device speech recognition is available on the device.
   */
  supportsOnDeviceRecognition(): boolean;
  /**
   * Whether the recording feature is available on the device.
   *
   * This mostly applies to Android devices, to check if it's greater than Android 13.
   */
  supportsRecording(): boolean;
  /**
   * Whether on-device speech recognition is available.
   *
   * If this method returns false, `start()` will fail and emit an error event with the code `service-not-allowed` or `language-not-supported`.
   */
  isRecognitionAvailable(): boolean;

  /**
   * Downloads the offline model for the specified locale.
   * Note: this is only supported on Android 13 and above.
   */
  androidTriggerOfflineModelDownload(options: {
    /** The locale to download the model for, e.g. "en-US" */
    locale: string;
  }): Promise<{
    /**
     * On Android 13, the status will be "opened_dialog" indicating that the model download dialog was opened.
     * On Android 14+, the status will be "download_success" indicating that the model download was successful.
     * On Android 14+, "download_canceled" will be returned if the download was canceled by a user interaction.
     */
    status: "download_success" | "opened_dialog" | "download_canceled";
    message: string;
  }>;
  /**
   * [iOS only] For advanced use cases, you may use this function to set the audio session category and mode.
   *
   * See: https://developer.apple.com/documentation/avfaudio/avaudiosession/1771734-setcategory
   */
  setCategoryIOS(options: SetCategoryOptions): void;

  /**
   * [iOS only] Returns the current audio session category and options.
   *
   * See:
   * - [AVAudioSession.Category](https://developer.apple.com/documentation/avfaudio/avaudiosession/category)
   * - [AVAudioSession.CategoryOptions](https://developer.apple.com/documentation/avfaudio/avaudiosession/categoryoptions)
   * - [AVAudioSession.Mode](https://developer.apple.com/documentation/avfaudio/avaudiosession/mode)
   */
  getAudioSessionCategoryAndOptionsIOS(): {
    category: AVAudioSessionCategoryValue;
    categoryOptions: AVAudioSessionCategoryOptionsValue[];
    mode: AVAudioSessionModeValue;
  };
  /**
   * [iOS only] Sets the shared audio session active state.
   *
   * Calls the following on iOS: `AVAudioSession.sharedInstance().setActive(value, options)`
   *
   * See: https://developer.apple.com/documentation/avfaudio/avaudiosession/1616627-setactive
   */
  setAudioSessionActiveIOS(
    value: boolean,
    options?: {
      /** [Default: true] Whether to notify other audio sessions when the active state changes. */
      notifyOthersOnDeactivation: boolean;
    },
  ): void;
  /**
   * Returns the current state of the speech recognizer.
   */
  getStateAsync(): Promise<SpeechRecognitionState>;
}

export type SetCategoryOptions = {
  category: AVAudioSessionCategoryValue;
  categoryOptions: AVAudioSessionCategoryOptionsValue[];
  mode?: AVAudioSessionModeValue;
};

type SpeechRecognitionState =
  | "inactive"
  | "starting"
  | "recognizing"
  | "stopping";

/**
 * [iOS only] See: [AVAudioSession.CategoryOptions](https://developer.apple.com/documentation/avfaudio/avaudiosession/categoryoptions)
 *
 * Use the `AVAudioSessionCategoryOptions` enum to get the correct value.
 */
export type AVAudioSessionCategoryOptionsValue =
  (typeof AVAudioSessionCategoryOptions)[keyof typeof AVAudioSessionCategoryOptions];

/**
 * [iOS only] See: [AVAudioSession.Mode](https://developer.apple.com/documentation/avfaudio/avaudiosession/mode)
 *
 * Use the `AVAudioSessionMode` enum to get the correct value.
 */
export type AVAudioSessionModeValue =
  (typeof AVAudioSessionMode)[keyof typeof AVAudioSessionMode];
