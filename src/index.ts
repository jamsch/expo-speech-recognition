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

export {
  ExpoSpeechRecognitionModule,
  ExpoSpeechRecognitionModuleEmitter,
} from "./ExpoSpeechRecognitionModule";

export const getSupportedLocales = (options?: {
  androidRecognitionServicePackage?: string;
  onDevice?: boolean;
}) => ExpoSpeechRecognitionModule.getSupportedLocales(options ?? {});

export const getSpeechRecognitionServices =
  ExpoSpeechRecognitionModule.getSpeechRecognitionServices;

export const requestPermissionAsync =
  ExpoSpeechRecognitionModule.requestPermissionAsync;

export const isOnDeviceRecognitionAvailable =
  ExpoSpeechRecognitionModule.isOnDeviceRecognitionAvailable;

export { type ExpoSpeechRecognitionOptions } from "./ExpoSpeechRecognitionModule.types";
