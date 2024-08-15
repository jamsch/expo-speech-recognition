let browserSpeechRecognition: typeof SpeechRecognition | null = null;
let browserSpeechGrammarList: typeof SpeechGrammarList | null = null;
let browserSpeechRecognitionEvent: typeof SpeechRecognitionEvent | null = null;

if (typeof webkitSpeechRecognition !== "undefined") {
  browserSpeechRecognition = webkitSpeechRecognition;
  browserSpeechGrammarList = webkitSpeechGrammarList;
  browserSpeechRecognitionEvent = webkitSpeechRecognitionEvent;
} else if (typeof SpeechRecognition !== "undefined") {
  browserSpeechRecognition = SpeechRecognition;
  browserSpeechGrammarList = SpeechGrammarList;
  browserSpeechRecognitionEvent = SpeechRecognitionEvent;
}

export const ExpoWebSpeechRecognition = browserSpeechRecognition;
export const ExpoWebSpeechGrammarList = browserSpeechGrammarList;
export const ExpoWebSpeechRecognitionEvent = browserSpeechRecognitionEvent;
