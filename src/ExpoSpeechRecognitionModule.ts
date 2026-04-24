import {
  NativeEventEmitter,
  NativeModules,
  type EmitterSubscription,
  type NativeModule,
} from "react-native";

import type { ExpoSpeechRecognitionModuleType } from "./ExpoSpeechRecognitionModule.types";

const rawNativeModule = NativeModules.ExpoSpeechRecognition as unknown;

if (!rawNativeModule) {
  throw new Error(
    "ExpoSpeechRecognition native module is not linked. Verify the React Native iOS/Android native module integration.",
  );
}

const nativeModule = rawNativeModule as ExpoSpeechRecognitionModuleType;
const nativeEventEmitter = new NativeEventEmitter(rawNativeModule as NativeModule);

export const ExpoSpeechRecognitionModule: ExpoSpeechRecognitionModuleType = {
  ...nativeModule,
  addListener(eventName, listener): EmitterSubscription {
    return nativeEventEmitter.addListener(eventName, listener);
  },
};
