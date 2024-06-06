import type { PermissionResponse } from "expo-modules-core";
import type { NativeModule } from "react-native";

export type ExpoSpeechRecognitionOptions = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  /** An array of strings that will be used to provide context to the speech recognition engine. */
  contextualStrings?: string[];
  continuous: boolean;
  requiresOnDeviceRecognition: boolean;
  addsPunctuation: boolean;
};

export interface ExpoSpeechRecognitionModuleType extends NativeModule {
  start(options: ExpoSpeechRecognitionOptions): void;
  stop(): void;
  /** Requests speech recognition and recording permissions prior to starting speech recognition. */
  requestPermissionAsync(): Promise<PermissionResponse>;
  /** Returns an array of locales supported by the speech recognizer. */
  getSupportedLocales(): string[];
  /**
   * Returns an array of package names of speech recognition services that are available on the device.
   * Note: this may not return _all_ speech recognition services that are available on the device if you have not configured `androidSpeechServicePackages` in your app.json.
   *
   * e.g. `["com.google.android.googlequicksearchbox"]`
   */
  getSpeechRecognitionServices(): string[];
}
