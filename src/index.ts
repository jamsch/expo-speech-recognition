import { ExpoSpeechRecognitionModule } from "./ExpoSpeechRecognitionModule";

// Export the SpeechRecognition APIs
export {
  ExpoWebSpeechRecognition,
  ExpoWebSpeechGrammar,
  ExpoWebSpeechGrammarList,
} from "./ExpoWebSpeechRecognition";

// Hooks and helpers
export {
  createSpeechRecognizer,
  useWebSpeechRecognitionEvent,
} from "./createSpeechRecognizer";

// Native module
export {
  ExpoSpeechRecognitionModule,
  ExpoSpeechRecognitionModuleEmitter,
} from "./ExpoSpeechRecognitionModule";

// Hooks
export { useNativeEvent } from "./useNativeEvent";

// Constants
export {
  AVAudioSessionCategory,
  AVAudioSessionCategoryOptions,
  AVAudioSessionMode,
  RecognizerIntentExtraLanguageModel,
  RecognizerIntentEnableLanguageSwitch,
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
