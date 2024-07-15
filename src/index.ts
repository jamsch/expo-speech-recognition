import { ExpoSpeechRecognitionModule } from "./ExpoSpeechRecognitionModule";

// Export the SpeechRecognition APIs
export {
  ExpoSpeechRecognition,
  ExpoSpeechGrammar,
  ExpoSpeechGrammarList,
} from "./ExpoSpeechRecognition";

// Hooks and helpers
export {
  createSpeechRecognizer,
  useSpeechRecognitionEvent,
} from "./createSpeechRecognizer";

// Native module
export {
  ExpoSpeechRecognitionModule,
  ExpoSpeechRecognitionModuleEmitter,
} from "./ExpoSpeechRecognitionModule";

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
