import { ExpoSpeechRecognitionModule } from "./ExpoSpeechRecognitionModule";

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

export const addSpeechRecognitionListener =
  ExpoSpeechRecognitionModule.addListener;

/**
 * Stops speech recognition and waits for the "end" event before resolving.
 */
export const stopAsync = (): Promise<void> => {
  return new Promise((resolve) => {
    const subscription = ExpoSpeechRecognitionModule.addListener("end", () => {
      subscription.remove();
      resolve();
    });
    ExpoSpeechRecognitionModule.stop();
  });
};

/**
 * Aborts speech recognition and waits for the "end" event before resolving.
 */
export const abortAsync = (): Promise<void> => {
  return new Promise((resolve) => {
    const subscription = ExpoSpeechRecognitionModule.addListener("end", () => {
      subscription.remove();
      resolve();
    });
    ExpoSpeechRecognitionModule.abort();
  });
};

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
