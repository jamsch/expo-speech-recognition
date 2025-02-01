let browserSpeechRecognition: typeof SpeechRecognition | null = null;
let browserSpeechGrammarList: typeof SpeechGrammarList | null = null;
let browserSpeechRecognitionEvent: typeof SpeechRecognitionEvent | null = null;

if (typeof webkitSpeechRecognition !== "undefined") {
  browserSpeechRecognition = webkitSpeechRecognition;
  browserSpeechGrammarList =
    typeof webkitSpeechGrammarList !== "undefined"
      ? webkitSpeechGrammarList
      : null;
  browserSpeechRecognitionEvent =
    typeof webkitSpeechRecognitionEvent !== "undefined"
      ? webkitSpeechRecognitionEvent
      : null;
} else if (typeof SpeechRecognition !== "undefined") {
  browserSpeechRecognition = SpeechRecognition;
  browserSpeechGrammarList =
    typeof SpeechGrammarList !== "undefined" ? SpeechGrammarList : null;
  browserSpeechRecognitionEvent =
    typeof SpeechRecognitionEvent !== "undefined"
      ? SpeechRecognitionEvent
      : null;
}

export const ExpoWebSpeechRecognition = browserSpeechRecognition;
export const ExpoWebSpeechGrammarList = browserSpeechGrammarList;
export const ExpoWebSpeechRecognitionEvent = browserSpeechRecognitionEvent;
