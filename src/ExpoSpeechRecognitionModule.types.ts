import type { PermissionResponse } from "expo-modules-core";
import type { NativeModule } from "react-native";

export interface ExpoSpeechRecognitionModule extends NativeModule {
  start(options: {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    /** An array of strings that will be used to provide context to the speech recognition engine. */
    contextualStrings: string[];
    continuous: boolean;
    requiresOnDeviceRecognition: boolean;
    addsPunctuation: boolean;
  }): void;
  stop(): void;
  requestPermissionAsync(): Promise<PermissionResponse>;
}
