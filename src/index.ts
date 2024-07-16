import { ExpoSpeechRecognitionModule } from "./ExpoSpeechRecognitionModule";

// Export the SpeechRecognition APIs
export {
  ExpoWebSpeechRecognition,
  ExpoWebSpeechGrammar,
  ExpoWebSpeechGrammarList,
} from "./ExpoWebSpeechRecognition";

// Hooks and helpers
export {
  createWebSpeechRecognizer,
  useWebSpeechRecognitionEvent,
} from "./createWebSpeechRecognizer";

// Native module
export {
  ExpoSpeechRecognitionModule,
  ExpoSpeechRecognitionModuleEmitter,
} from "./ExpoSpeechRecognitionModule";

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
} from "./constants";

export const getSupportedLocales = (options?: {
  androidRecognitionServicePackage?: string;
  onDevice?: boolean;
}) => ExpoSpeechRecognitionModule.getSupportedLocales(options ?? {});

export const getSpeechRecognitionServices =
  ExpoSpeechRecognitionModule.getSpeechRecognitionServices;

export const requestPermissionsAsync =
  ExpoSpeechRecognitionModule.requestPermissionsAsync;

export const isOnDeviceRecognitionAvailable =
  ExpoSpeechRecognitionModule.isOnDeviceRecognitionAvailable;

export const setCategoryIOS = ExpoSpeechRecognitionModule.setCategoryIOS;

export const getAudioSessionCategoryAndOptionsIOS =
  ExpoSpeechRecognitionModule.getAudioSessionCategoryAndOptionsIOS;

export {
  type ExpoSpeechRecognitionOptions,
  type AndroidIntentOptions,
  type ExpoSpeechRecognitionNativeEventMap,
  type AVAudioSessionCategoryOptionsValue,
  type AVAudioSessionModeValue,
  type AVAudioSessionCategoryValue,
  type AudioEncodingAndroidValue,
  type AudioSourceOptions,
  type RecordingOptions,
} from "./ExpoSpeechRecognitionModule.types";
