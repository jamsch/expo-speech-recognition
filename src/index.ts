import {
  ExpoSpeechRecognitionModule,
  ExpoSpeechRecognitionModuleEmitter,
} from "./ExpoSpeechRecognitionModule";
import type { ExpoSpeechRecognitionNativeEventMap } from "./ExpoSpeechRecognitionModule.types";

// Export the SpeechRecognition APIs
export {
  ExpoWebSpeechRecognition,
  ExpoWebSpeechGrammar,
  ExpoWebSpeechGrammarList,
} from "./ExpoWebSpeechRecognition";

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
  TaskHintIOS,
} from "./constants";

export const getSupportedLocales = (options?: {
  androidRecognitionServicePackage?: string;
}) => ExpoSpeechRecognitionModule.getSupportedLocales(options ?? {});

export const getSpeechRecognitionServices =
  ExpoSpeechRecognitionModule.getSpeechRecognitionServices;

export const supportsOnDeviceRecognition =
  ExpoSpeechRecognitionModule.supportsOnDeviceRecognition;

export const supportsRecording = ExpoSpeechRecognitionModule.supportsRecording;

export const setCategoryIOS = ExpoSpeechRecognitionModule.setCategoryIOS;

export const getAudioSessionCategoryAndOptionsIOS =
  ExpoSpeechRecognitionModule.getAudioSessionCategoryAndOptionsIOS;

export const setAudioSessionActiveIOS =
  ExpoSpeechRecognitionModule.setAudioSessionActiveIOS;

export const androidTriggerOfflineModelDownload =
  ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload;

export const isRecognitionAvailable =
  ExpoSpeechRecognitionModule.isRecognitionAvailable;

export const getDefaultRecognitionService =
  ExpoSpeechRecognitionModule.getDefaultRecognitionService;

export const getAssistantService =
  ExpoSpeechRecognitionModule.getAssistantService;

export const addSpeechRecognitionListener = <
  T extends keyof ExpoSpeechRecognitionNativeEventMap,
>(
  eventName: T,
  listener: (ev: ExpoSpeechRecognitionNativeEventMap[T]) => void,
) => ExpoSpeechRecognitionModuleEmitter.addListener(eventName, listener);

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
  type IOSTaskHintValue,
  type SetCategoryOptions,
  type ExpoSpeechRecognitionErrorCode,
  type ExpoSpeechRecognitionErrorEvent,
  type ExpoSpeechRecognitionResultEvent,
  type ExpoSpeechRecognitionResult,
  type ExpoSpeechRecognitionResultSegment,
} from "./ExpoSpeechRecognitionModule.types";
