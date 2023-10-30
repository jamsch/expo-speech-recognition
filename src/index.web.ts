import "dom-speech-recognition";

export const ExpoSpeechRecognition =
  SpeechRecognition || webkitSpeechRecognition;

export const ExpoSpeechGrammarList =
  SpeechGrammarList || webkitSpeechGrammarList;

export const ExpoSpeechRecognitionEvent =
  SpeechRecognitionEvent || webkitSpeechRecognitionEvent;
