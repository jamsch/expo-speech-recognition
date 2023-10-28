import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';

import { ExpoSpeechRecognitionViewProps } from './ExpoSpeechRecognition.types';

const NativeView: React.ComponentType<ExpoSpeechRecognitionViewProps> =
  requireNativeViewManager('ExpoSpeechRecognition');

export default function ExpoSpeechRecognitionView(props: ExpoSpeechRecognitionViewProps) {
  return <NativeView {...props} />;
}
