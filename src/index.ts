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

export const getSupportedLocales =
  ExpoSpeechRecognitionModule.getSupportedLocales;

export const requestPermissionAsync =
  ExpoSpeechRecognitionModule.requestPermissionAsync;

export { type ExpoSpeechRecognitionOptions } from "./ExpoSpeechRecognitionModule.types";
