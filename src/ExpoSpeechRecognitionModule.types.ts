import type { PermissionResponse } from "expo-modules-core";
import type { NativeModule } from "react-native";
import {
  AudioEncodingAndroid,
  AVAudioSessionCategory,
  AVAudioSessionCategoryOptions,
  AVAudioSessionMode,
  RecognizerIntentEnableLanguageSwitch,
  RecognizerIntentExtraLanguageModel,
} from "./constants";

export type AVAudioSessionCategoryValue =
  (typeof AVAudioSessionCategory)[keyof typeof AVAudioSessionCategory];

/**
 * Events that are dispatched from the native side
 */
export type ExpoSpeechRecognitionNativeEventMap = {
  /** Fired when there's a speech result. The result may be partial or final */
  result: {
    isFinal: boolean;
    results: {
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
       * - The segment parts are split up by words.
       * - The segments are only available for the first transcript
       */
      segements: {
        /** The start timestamp of the utterance, e.g. 1000 */
        startTimeMillis: number;
        /** The end timestamp of the utterance, e.g. 1500 */
        endTimeMillis: number;
        /** The text portion of the transcript, e.g. "Hello world" */
        segment: string;
        /** Value ranging between between 0.0, 1.0, and -1 (unavailable) indicating the confidence of the specific segement */
        confidence: number;
      }[];
    }[];
  };
  /**
   * Fired when the recording has completed, nonstandard to web API.
   * This event will only fire if `recordingOptions.persist` is enabled
   * when starting speech recognition
   */
  recording: { filePath: string };
  error: { code: string; message: string };
  start: null;
  speechstart: null;
  speechend: null;
  soundstart: null;
  /** A final result is returned with no significant recognition */
  nomatch: null;
};

export type ExpoSpeechRecognitionOptions = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  /** An array of strings that will be used to provide context to the speech recognition engine. */
  contextualStrings?: string[];
  continuous: boolean;
  requiresOnDeviceRecognition: boolean;
  addsPunctuation: boolean;
  /**
   * The package name of the speech recognition service to use.
   * If not provided, the default service will be used.
   *
   * Obtain the supported packages by running `ExpoSpeechRecognitionModule.getSpeechRecognitionServices()`
   *
   * e.g. "com.google.android.googlequicksearchbox"
   */
  androidRecognitionServicePackage?: string;
  /**
   * Extra options to provide to the Android Recognition intent.
   * For a full list of options, see https://developer.android.com/reference/android/speech/RecognizerIntent
   */
  androidIntentOptions?: Partial<AndroidIntentOptions>;
  /**
   * Audio source options to pass to the recognizer.
   *
   * This option can be used to recognize audio from a local or remote file path.
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
};

export type RecordingOptions = {
  /**
   * Whether to persist the audio to a local file path.
   *
   * Default: false
   */
  persist: boolean;
  /**
   * This changes the default storage location for the audio file.
   */
  outputFilePath?: string;
};

export type AudioSourceOptions = {
  /**
   * Local or remote audio source URI.
   *
   * e.g.
   *
   * - `"file:///storage/emulated/0/Download/audio.wav"`
   * - `"https://example.com/audio.wav"`
   */
  uri: string;
  /**
   * [Android only] The number of channels in the source audio.
   *
   * Default: 1
   */
  audioChannels?: number;
  /**
   * [Android only] A value from [AudioFormat](https://developer.android.com/reference/android/media/AudioFormat) for Android.
   *
   * Use the `AudioEncodingAndroid` enum to get the correct value.
   */
  audioEncoding?: AudioEncodingAndroidValue;
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

export interface ExpoSpeechRecognitionModuleType extends NativeModule {
  start(options: ExpoSpeechRecognitionOptions): void;
  stop(): void;
  /** Requests speech recognition and recording permissions prior to starting speech recognition. */
  requestPermissionsAsync(): Promise<PermissionResponse>;
  /** Returns an array of locales supported by the speech recognizer. */
  getSupportedLocales(options: {
    /** The package name of the speech recognition service to use. */
    androidRecognitionServicePackage?: string;
    /** If true, will return the installed locales of the on-device speech recognition service. */
    onDevice?: boolean;
  }): Promise<{
    /**
     * All supported languages on the device. This includes both installed and supported languages.
     */
    locales: string[];
    /**
     * These languages are installed on to the device for offline use.
     */
    installedLocales: string[];
  }>;
  /**
   * Returns an array of package names of speech recognition services that are available on the device.
   * Note: this may not return _all_ speech recognition services that are available on the device if you have not configured `androidSpeechServicePackages` in your app.json.
   *
   * e.g. `["com.google.android.googlequicksearchbox"]`
   */
  getSpeechRecognitionServices(): string[];
  /**
   * Whether the on-device speech recognition is available on the device.
   */
  isOnDeviceRecognitionAvailable(): boolean;
  /**
   * Downloads the offline model for the specified locale.
   * Note: this is only supported on Android 12 and above.
   */
  androidTriggerOfflineModelDownload(options: {
    /** The locale to download the model for, e.g. "en-US" */
    locale: string;
  }): Promise<boolean>;
  /**
   * [iOS only] For advanced use cases, you may use this function to set the audio session category and mode.
   *
   * See: https://developer.apple.com/documentation/avfaudio/avaudiosession/1771734-setcategory
   */
  setCategoryIOS(options: {
    category: AVAudioSessionCategoryValue;
    categoryOptions: AVAudioSessionCategoryOptionsValue[];
    mode?: AVAudioSessionModeValue;
  }): void;
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
}

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
