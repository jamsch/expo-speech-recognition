// Export the SpeechRecognition APIs
export {
  ExpoWebSpeechRecognition,
  ExpoWebSpeechGrammar,
  ExpoWebSpeechGrammarList,
} from "./ExpoWebSpeechRecognition";

// Native module
export { ExpoSpeechRecognitionModule } from "./ExpoSpeechRecognitionModule";

// Hooks
export { useSpeechRecognitionEvent } from "./useSpeechRecognitionEvent";

// Constants
export {
  AVAudioSessionCategory,
  AVAudioSessionCategoryOptions,
  AVAudioSessionMode,
  RecognizerIntentExtraLanguageModel,
  RecognizerIntentEnableLanguageSwitch,
  AudioEncodingAndroid,
  TaskHintIOS,
  SpeechRecognizerErrorAndroid,
} from "./constants";

export type {
  ExpoSpeechRecognitionOptions,
  AndroidIntentOptions,
  ExpoSpeechRecognitionNativeEventMap,
  AVAudioSessionCategoryOptionsValue,
  AVAudioSessionModeValue,
  AVAudioSessionCategoryValue,
  AudioEncodingAndroidValue,
  AudioSourceOptions,
  RecordingOptions,
  IOSTaskHintValue,
  SetCategoryOptions,
  ExpoSpeechRecognitionErrorCode,
  ExpoSpeechRecognitionErrorEvent,
  ExpoSpeechRecognitionResultEvent,
  ExpoSpeechRecognitionResult,
  ExpoSpeechRecognitionResultSegment,
} from "./ExpoSpeechRecognitionModule.types";
