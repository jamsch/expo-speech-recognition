// Import the native module. On web, it will be resolved to ExpoSpeechRecognition.web.ts
// and on native platforms to ExpoSpeechRecognition.ts
import type { EventSubscription } from "expo-modules-core";
import { ExpoSpeechRecognitionModule } from "./ExpoSpeechRecognitionModule";
import type {
  ExpoSpeechRecognitionNativeEventMap,
  ExpoSpeechRecognitionOptions,
} from "./ExpoSpeechRecognitionModule.types";

const noop = () => {};

const createEventData = (target: EventTarget) => ({
  AT_TARGET: 2 as const,
  bubbles: false,
  BUBBLING_PHASE: 3 as const,
  cancelable: false,
  CAPTURING_PHASE: 1 as const,
  composed: false,
  composedPath: () => [],
  currentTarget: target,
  defaultPrevented: false,
  eventPhase: 0,
  isTrusted: true,
  NONE: 0 as const,
  preventDefault: noop,
  resultIndex: 0,
  stopImmediatePropagation: noop,
  stopPropagation: noop,
  target,
  timeStamp: 0,
  type: "",
  cancelBubble: false,
  returnValue: false,
  srcElement: null,
  initEvent: noop,
});

type NativeEventAndListener<
  TEventName extends keyof ExpoSpeechRecognitionNativeEventMap,
> = {
  /** Event name to listen for on native side */
  eventName: TEventName;
  nativeListener: (
    nativeEvent: ExpoSpeechRecognitionNativeEventMap[TEventName],
  ) => void;
};

function stubEvent<K extends keyof SpeechRecognitionEventMap>(
  eventName: K,
  instance: ExpoWebSpeechRecognition,
  listener: (this: SpeechRecognition, ev: Event) => unknown,
): NativeEventAndListener<K> {
  return {
    eventName,
    nativeListener: (nativeEvent) =>
      listener.call(instance, createEventData(instance)),
  };
}

/**
 * Transforms the native listener payloads to web-compatible shapes
 */
const WebListenerTransformers: {
  [K in keyof SpeechRecognitionEventMap]?: (
    instance: ExpoWebSpeechRecognition,
    listener: (
      this: SpeechRecognition,
      ev: SpeechRecognitionEventMap[K],
    ) => unknown,
  ) => NativeEventAndListener<K>;
} = {
  audiostart: (instance, listener) => {
    return {
      eventName: "audiostart",
      nativeListener(nativeEvent) {
        listener.call(instance, {
          ...createEventData(instance),
          uri: nativeEvent.uri,
        });
      },
    };
  },
  audioend: (instance, listener) => {
    return {
      eventName: "audioend",
      nativeListener(nativeEvent) {
        listener.call(instance, {
          ...createEventData(instance),
          uri: nativeEvent.uri,
        });
      },
    };
  },
  nomatch: (instance, listener) => {
    // @ts-ignore
    return stubEvent("nomatch", instance, listener);
  },
  end: (instance, listener) => {
    return stubEvent("end", instance, listener);
  },
  start: (instance, listener) => {
    return {
      eventName: "start",
      nativeListener() {
        listener.call(instance, createEventData(instance));
      },
    };
  },
  error: (instance, listener) => {
    return {
      eventName: "error",
      nativeListener: (
        nativeEvent: ExpoSpeechRecognitionNativeEventMap["error"],
      ) => {
        const clientEvent: SpeechRecognitionEventMap["error"] = {
          ...createEventData(instance),
          // TODO: handle custom ios error codes
          error: nativeEvent.error as SpeechRecognitionErrorCode,
          message: nativeEvent.message,
        };
        listener.call(instance, clientEvent);
      },
    };
  },
  result: (instance, listener) => {
    return {
      eventName: "result",
      nativeListener: (
        nativeEvent: ExpoSpeechRecognitionNativeEventMap["result"],
      ) => {
        if (!instance.interimResults && !nativeEvent.isFinal) {
          return;
        }
        const alternatives = nativeEvent.results.map(
          (result) =>
            new ExpoSpeechRecognitionAlternative(
              result.confidence,
              result.transcript,
            ),
        );
        const clientEvent: SpeechRecognitionEventMap["result"] = {
          ...createEventData(instance),
          results: new ExpoSpeechRecognitionResultList([
            new ExpoSpeechRecognitionResult(nativeEvent.isFinal, alternatives),
          ]),
        };
        listener.call(instance, clientEvent);
      },
    };
  },
};

type SpeechListener<K extends keyof SpeechRecognitionEventMap> = (
  this: SpeechRecognition,
  ev: SpeechRecognitionEventMap[K],
) => any;

/** A compatibility wrapper that implements the web SpeechRecognition API for React Native. */
export class ExpoWebSpeechRecognition implements SpeechRecognition {
  lang = "en-US";
  grammars: SpeechGrammarList = new ExpoWebSpeechGrammarList();
  maxAlternatives = 1;
  continuous = false;

  #interimResults = false;

  get interimResults(): boolean {
    return this.#interimResults;
  }

  set interimResults(interimResults: boolean) {
    this.#interimResults = interimResults;
    // Subscribe to native
  }

  // Extended properties

  /** [EXTENDED, default: undefined] An array of strings that will be used to provide context to the speech recognition engine. */
  contextualStrings?: string[] = undefined;
  /** [EXTENDED, default: false] Whether the speech recognition engine should require the device to be on when the recognition starts. */
  requiresOnDeviceRecognition = false;
  /** [EXTENDED, default: false] Whether the speech recognition engine should add punctuation to the transcription. */
  addsPunctuation = false;
  /** [EXTENDED, default: undefined] Android-specific options to pass to the recognizer. */
  androidIntentOptions: ExpoSpeechRecognitionOptions["androidIntentOptions"];
  /** [EXTENDED, default: undefined] Audio source options to pass to the recognizer. */
  audioSource?: ExpoSpeechRecognitionOptions["audioSource"];
  /** [EXTENDED, default: undefined] Audio recording options to pass to the recognizer. */
  recordingOptions?: ExpoSpeechRecognitionOptions["recordingOptions"];
  /** [EXTENDED, default: "android.speech.action.RECOGNIZE_SPEECH"] The kind of intent action */
  androidIntent?: ExpoSpeechRecognitionOptions["androidIntent"] = undefined;
  /** [EXTENDED, default: undefined] The hint for the speech recognition task. */
  iosTaskHint?: ExpoSpeechRecognitionOptions["iosTaskHint"] = undefined;
  /** [EXTENDED, default: undefined] The audio session category and options to use. */
  iosCategory?: ExpoSpeechRecognitionOptions["iosCategory"] = undefined;
  /**
   * [EXTENDED, default: undefined]
   *
   * The package name of the speech recognition service to use.
   * If not provided, the default service will be used.
   *
   * Obtain the supported packages by running `ExpoSpeechRecognitionModule.getSpeechRecognitionServices()`
   *
   * e.g. com.samsung.android.bixby.agent"
   */
  androidRecognitionServicePackage: ExpoSpeechRecognitionOptions["androidRecognitionServicePackage"];

  // keyed by listener function
  #subscriptionMap: Map<SpeechListener<any>, EventSubscription[]> = new Map();

  start() {
    ExpoSpeechRecognitionModule.requestPermissionsAsync().then(() => {
      // A result doesn't matter,
      // the module will emit an error if permissions are not granted
      ExpoSpeechRecognitionModule.start({
        lang: this.lang,
        interimResults: this.interimResults,
        maxAlternatives: this.maxAlternatives,
        contextualStrings: this.contextualStrings,
        requiresOnDeviceRecognition: this.requiresOnDeviceRecognition,
        addsPunctuation: this.addsPunctuation,
        continuous: this.continuous,
        recordingOptions: this.recordingOptions,
        androidIntentOptions: this.androidIntentOptions,
        androidRecognitionServicePackage: this.androidRecognitionServicePackage,
        audioSource: this.audioSource,
        androidIntent: this.androidIntent,
        iosTaskHint: this.iosTaskHint,
        iosCategory: this.iosCategory,
      });
    });
  }
  stop = ExpoSpeechRecognitionModule.stop;
  abort = ExpoSpeechRecognitionModule.abort;

  #onstart: SpeechListener<"start"> | null = null;
  set onstart(listener: SpeechListener<"start"> | null) {
    this._setListeners("start", listener, this.#onstart);
    this.#onstart = listener;
  }
  /** Fired when the speech recognition starts. */
  get onstart() {
    return this.#onstart;
  }

  #onend: SpeechListener<"end"> | null = null;
  set onend(listener: SpeechListener<"end"> | null) {
    this._setListeners(
      "end",
      (ev) => {
        listener?.call(this, ev);
      },
      this.#onend,
    );
    this.#onend = listener;
  }
  /** Fired when the speech recognition service has disconnected. */
  get onend() {
    return this.#onend;
  }

  #onerror: SpeechListener<"error"> | null = null;
  set onerror(listener: SpeechListener<"error"> | null) {
    this._setListeners("error", listener, this.#onerror);
    this.#onerror = listener;
  }
  /** Fired when the speech recognition service encounters an error. */
  get onerror() {
    return this.#onerror;
  }

  _setListeners<K extends keyof SpeechRecognitionEventMap>(
    key: K,
    listenerFn: SpeechListener<K> | null,
    existingListener: SpeechListener<K> | null,
  ) {
    if (existingListener) {
      this.removeEventListener(key, existingListener);
    }
    if (listenerFn) {
      this.addEventListener(key, listenerFn);
    }
  }

  #onresult: SpeechListener<"result"> | null = null;
  set onresult(listener: SpeechListener<"result"> | null) {
    this._setListeners("result", listener, this.#onresult);
    this.#onresult = listener;
  }
  /** Fired when the speech recognition service returns a result —
   *  a word or phrase has been positively recognized and this has been communicated back to the app. */
  get onresult() {
    return this.#onresult;
  }

  #onnomatch: SpeechListener<"nomatch"> | null = null;
  set onnomatch(listener: SpeechListener<"nomatch"> | null) {
    this._setListeners("nomatch", listener, this.#onnomatch);
    this.#onnomatch = listener;
  }
  /** Fired when the speech recognition service returns a final result with no significant recognition. */
  get onnomatch() {
    return this.#onnomatch;
  }

  #onspeechstart: SpeechListener<"speechstart"> | null = null;
  set onspeechstart(listener: SpeechListener<"speechstart"> | null) {
    this._setListeners("speechstart", listener, this.#onspeechstart);
    this.#onspeechstart = listener;
  }
  /** Fired when the speech recognition service returns a final result with no significant recognition. */
  get onspeechstart() {
    return this.#onspeechstart;
  }

  #onspeechend: SpeechListener<"speechend"> | null = null;
  set onspeechend(listener: SpeechListener<"speechend"> | null) {
    this._setListeners("speechend", listener, this.#onspeechend);
    this.#onspeechend = listener;
  }
  /** Fired when the speech recognition service returns a final result with no significant recognition. */
  get onspeechend() {
    return this.#onspeechend;
  }

  #onaudiostart: SpeechListener<"audiostart"> | null = null;
  set onaudiostart(listener: SpeechListener<"audiostart"> | null) {
    this._setListeners("audiostart", listener, this.#onaudiostart);
    this.#onaudiostart = listener;
  }
  /** Fired when the user agent has started to capture audio. */
  get onaudiostart() {
    return this.#onaudiostart;
  }

  #onaudioend: SpeechListener<"audioend"> | null = null;
  set onaudioend(listener: SpeechListener<"audioend"> | null) {
    this._setListeners("audioend", listener, this.#onaudioend);
    this.#onaudioend = listener;
  }
  /** Fired when the user agent has finished capturing audio. */
  get onaudioend() {
    return this.#onaudioend;
  }

  /** [TODO] */
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null = null;
  /** [TODO] */
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null = null;

  addEventListener<K extends keyof SpeechRecognitionEventMap>(
    type: K,
    listener: SpeechListener<K>,
    options?: boolean | AddEventListenerOptions,
  ): void {
    const once = typeof options === "object" && options.once;

    // If the user opts in to only listening once,
    // wrap the listener in a function that removes the listener
    const wrappedListener = once
      ? (((ev) => {
          listener.call(this, ev);
          // remove the listeners from the map
          for (const sub of this.#subscriptionMap.get(listener) ?? []) {
            sub.remove();
          }
          this.#subscriptionMap.delete(listener);
        }) as SpeechListener<K>)
      : listener;

    // Enhance the native listener with any necessary polyfills
    const enhancedEvent: NativeEventAndListener<K> =
      WebListenerTransformers[type]?.(this, wrappedListener) ??
      stubEvent(
        type,
        this,
        wrappedListener as (this: SpeechRecognition, ev: Event) => unknown,
      );

    const subscription = ExpoSpeechRecognitionModule.addListener(
      enhancedEvent.eventName,
      // @ts-expect-error
      enhancedEvent.nativeListener,
    );

    // Store the subscriptions so we can remove them later
    // This is keyed by the listener function so we can remove all subscriptions for a given listener
    this.#subscriptionMap.set(listener, [subscription]);
  }

  removeEventListener<K extends keyof SpeechRecognitionEventMap>(
    type: K,
    listener: (
      this: SpeechRecognition,
      ev: SpeechRecognitionEventMap[K],
    ) => any,
    options?: boolean | EventListenerOptions | undefined,
  ): void {
    const subscriptions = this.#subscriptionMap.get(listener);
    if (subscriptions) {
      for (const subscription of subscriptions) {
        subscription.remove();
      }
      this.#subscriptionMap.delete(listener);
    }
  }

  dispatchEvent(event: Event): boolean {
    throw new Error("Method not implemented.");
  }
}

/**
 * This class is just a polyfill and does nothing on Android/iOS
 */
export class ExpoWebSpeechGrammarList implements SpeechGrammarList {
  get length() {
    return this.#grammars.length;
  }
  #grammars: ExpoWebSpeechGrammar[] = [];
  [index: number]: SpeechGrammar; // Indexer property

  addFromURI(src: string, weight?: number | undefined): void {
    // todo
  }

  item(index: number): ExpoWebSpeechGrammar {
    return this.#grammars[index];
  }

  addFromString = (grammar: string, weight?: number) => {
    // TODO: parse grammar to html entities (data:application/xml,....)
    this.#grammars.push(new ExpoWebSpeechGrammar(grammar, weight));
    // Set key on this object for compatibility with web SpeechGrammarList API
    this[this.length - 1] = this.#grammars[this.length - 1];
  };
}

export class ExpoWebSpeechGrammar implements SpeechGrammar {
  src = "";
  weight = 1;

  constructor(src: string, weight?: number) {
    this.src = src;
    this.weight = weight ?? 1;
  }
}

class ExpoSpeechRecognitionResultList implements SpeechRecognitionResultList {
  #results: ExpoSpeechRecognitionResult[] = [];

  [Symbol.iterator](): ArrayIterator<ExpoSpeechRecognitionResult> {
    return this.#results[
      Symbol.iterator
    ]() as ArrayIterator<ExpoSpeechRecognitionResult>;
  }
  length: number;
  item(index: number): SpeechRecognitionResult {
    return this.#results[index];
  }
  [index: number]: SpeechRecognitionResult;

  constructor(results: ExpoSpeechRecognitionResult[]) {
    this.#results = results;
    this.length = results.length;
    for (let i = 0; i < this.#results.length; i++) {
      this[i] = this.#results[i];
    }
  }
}

class ExpoSpeechRecognitionResult implements SpeechRecognitionResult {
  #alternatives: ExpoSpeechRecognitionAlternative[] = [];
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SpeechRecognitionResult/isFinal) */
  readonly isFinal: boolean;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SpeechRecognitionResult/length) */
  length: number;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SpeechRecognitionResult/item) */
  item(index: number): SpeechRecognitionAlternative {
    return this.#alternatives[index];
  }
  [index: number]: SpeechRecognitionAlternative;
  [Symbol.iterator](): ArrayIterator<SpeechRecognitionAlternative> {
    return this.#alternatives[
      Symbol.iterator
    ]() as ArrayIterator<SpeechRecognitionAlternative>;
  }

  constructor(
    isFinal: boolean,
    alternatives: ExpoSpeechRecognitionAlternative[],
  ) {
    this.isFinal = isFinal;
    this.length = alternatives.length;
    this.#alternatives = alternatives;
    for (let i = 0; i < alternatives.length; i++) {
      this[i] = alternatives[i];
    }
  }
}

class ExpoSpeechRecognitionAlternative implements SpeechRecognitionAlternative {
  confidence: number;
  transcript: string;

  constructor(confidence: number, transcript: string) {
    this.confidence = confidence;
    this.transcript = transcript;
  }
}
