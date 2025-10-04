import { ExpoSpeechRecognitionModule } from "./ExpoSpeechRecognitionModule";

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
