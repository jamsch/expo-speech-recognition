import {
  EventEmitter,
  NativeModulesProxy,
  requireNativeModule,
} from "expo-modules-core";
import type { ExpoSpeechRecognitionModuleType } from "./ExpoSpeechRecognitionModule.types";

// It loads the native module object from the JSI or falls back to
// the bridge module (from NativeModulesProxy) if the remote debugger is on.
export const ExpoSpeechRecognitionModule =
  requireNativeModule<ExpoSpeechRecognitionModuleType>("ExpoSpeechRecognition");

export const ExpoSpeechRecognitionModuleEmitter = new EventEmitter(
  ExpoSpeechRecognitionModule ?? NativeModulesProxy.ExpoSpeechRecognition,
);
