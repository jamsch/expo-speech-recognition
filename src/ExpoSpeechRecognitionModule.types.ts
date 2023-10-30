import type { PermissionResponse } from "expo-modules-core";
import type { NativeModule } from "react-native";

export interface ExpoSpeechRecognitionModule extends NativeModule {
  start(options: {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
  }): void;
  stop(): void;
  requestPermissionAsync(): Promise<PermissionResponse>;
}
