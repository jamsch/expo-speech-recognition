import { NativeModulesProxy, EventEmitter, Subscription } from 'expo-modules-core';

// Import the native module. On web, it will be resolved to ExpoSpeechRecognition.web.ts
// and on native platforms to ExpoSpeechRecognition.ts
import ExpoSpeechRecognitionModule from './ExpoSpeechRecognitionModule';
import ExpoSpeechRecognitionView from './ExpoSpeechRecognitionView';
import { ChangeEventPayload, ExpoSpeechRecognitionViewProps } from './ExpoSpeechRecognition.types';

// Get the native constant value.
export const PI = ExpoSpeechRecognitionModule.PI;

export function hello(): string {
  return ExpoSpeechRecognitionModule.hello();
}

export async function setValueAsync(value: string) {
  return await ExpoSpeechRecognitionModule.setValueAsync(value);
}

const emitter = new EventEmitter(ExpoSpeechRecognitionModule ?? NativeModulesProxy.ExpoSpeechRecognition);

export function addChangeListener(listener: (event: ChangeEventPayload) => void): Subscription {
  return emitter.addListener<ChangeEventPayload>('onChange', listener);
}

export { ExpoSpeechRecognitionView, ExpoSpeechRecognitionViewProps, ChangeEventPayload };
