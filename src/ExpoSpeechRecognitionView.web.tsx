import * as React from 'react';

import { ExpoSpeechRecognitionViewProps } from './ExpoSpeechRecognition.types';

export default function ExpoSpeechRecognitionView(props: ExpoSpeechRecognitionViewProps) {
  return (
    <div>
      <span>{props.name}</span>
    </div>
  );
}
