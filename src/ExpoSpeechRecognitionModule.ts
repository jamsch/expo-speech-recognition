import {
  EventEmitter,
  NativeModulesProxy,
  requireNativeModule,
} from "expo-modules-core";

import type { ExpoSpeechRecognitionModuleType } from "./ExpoSpeechRecognitionModule.types";

// It loads the native module object from the JSI or falls back to
// the bridge module (from NativeModulesProxy) if the remote debugger is on.
const ExpoSpeechRecognitionNativeModule =
  requireNativeModule<ExpoSpeechRecognitionModuleType>("ExpoSpeechRecognition");

export const ExpoSpeechRecognitionModule: ExpoSpeechRecognitionModuleType = {
  ...ExpoSpeechRecognitionNativeModule,
  // Avoid any function bindings when calling the native module
  stop: () => ExpoSpeechRecognitionNativeModule.stop(),
  abort: () => ExpoSpeechRecognitionNativeModule.abort(),
  requestPermissionsAsync: () =>
    ExpoSpeechRecognitionNativeModule.requestPermissionsAsync(),
  getPermissionsAsync: () =>
    ExpoSpeechRecognitionNativeModule.getPermissionsAsync(),
  getStateAsync: () => ExpoSpeechRecognitionNativeModule.getStateAsync(),
  getAssistantService: () =>
    ExpoSpeechRecognitionNativeModule.getAssistantService(),
  getDefaultRecognitionService: () =>
    ExpoSpeechRecognitionNativeModule.getDefaultRecognitionService(),
  getSpeechRecognitionServices: () =>
    ExpoSpeechRecognitionNativeModule.getSpeechRecognitionServices(),
  supportsOnDeviceRecognition: () =>
    ExpoSpeechRecognitionNativeModule.supportsOnDeviceRecognition(),
  supportsRecording: () =>
    ExpoSpeechRecognitionNativeModule.supportsRecording(),
  isRecognitionAvailable: () =>
    ExpoSpeechRecognitionNativeModule.isRecognitionAvailable(),
};

export const ExpoSpeechRecognitionModuleEmitter = new EventEmitter(
  ExpoSpeechRecognitionNativeModule ?? NativeModulesProxy.ExpoSpeechRecognition,
);
