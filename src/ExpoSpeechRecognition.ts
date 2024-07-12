import { Subscription } from "expo-modules-core";
// Import the native module. On web, it will be resolved to ExpoSpeechRecognition.web.ts
// and on native platforms to ExpoSpeechRecognition.ts
import {
  ExpoSpeechRecognitionModule,
  ExpoSpeechRecognitionModuleEmitter,
} from "./ExpoSpeechRecognitionModule";
import type { ExpoSpeechRecognitionOptions } from "./ExpoSpeechRecognitionModule.types";

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

type NativeEventAndListener = {
  /** Event name to listen for on native side */
  eventName: string;
  nativeListener: (nativeEvent: any) => void;
};

function stubEvent<K extends keyof SpeechRecognitionEventMap>(
  eventName: K,
  instance: ExpoSpeechRecognition,
  listener: (this: SpeechRecognition, ev: Event) => unknown,
): NativeEventAndListener {
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
    instance: ExpoSpeechRecognition,
    listener: (
      this: SpeechRecognition,
      ev: SpeechRecognitionEventMap[K],
    ) => unknown,
  ) => NativeEventAndListener[];
} = {
  nomatch: (instance, listener) => {
    // @ts-ignore
    return [stubEvent("nomatch", instance, listener)];
  },
  end: (instance, listener) => {
    return [stubEvent("end", instance, listener)];
  },
  start: (instance, listener) => {
    return [
      {
        eventName: "start",
        nativeListener() {
          listener.call(instance, createEventData(instance));
        },
      },
    ];
  },
  error: (instance, listener) => {
    return [
      {
        eventName: "error",
        nativeListener: (nativeEvent: {
          message: string;
          code: SpeechRecognitionErrorCode;
        }) => {
          const clientEvent: SpeechRecognitionEventMap["error"] = {
            ...createEventData(instance),
            error: nativeEvent.code,
            message: nativeEvent.message,
          };
          listener.call(instance, clientEvent);
        },
      },
    ];
  },
  result: (instance, listener) => {
    return [
      {
        eventName: "result",
        nativeListener: (nativeEvent: {
          isFinal: boolean;
          transcriptions: string[];
        }) => {
          if (!instance.interimResults && !nativeEvent.isFinal) {
            return;
          }
          const alternatives = nativeEvent.transcriptions.map(
            (result) => new ExpoSpeechRecognitionAlternative(1, result),
          );
          const clientEvent: SpeechRecognitionEventMap["result"] = {
            ...createEventData(instance),
            results: new ExpoSpeechRecognitionResultList([
              new ExpoSpeechRecognitionResult(
                nativeEvent.isFinal,
                alternatives,
              ),
            ]),
          };
          listener.call(instance, clientEvent);
        },
      },
    ];
  },
};

type SpeechListener<K extends keyof SpeechRecognitionEventMap> = (
  this: SpeechRecognition,
  ev: SpeechRecognitionEventMap[K],
) => any;

/** A compatibility wrapper that implements the web SpeechRecognition API for React Native. */
export class ExpoSpeechRecognition implements SpeechRecognition {
  lang: string = "en-US";
  grammars: SpeechGrammarList = new ExpoSpeechGrammarList();
  maxAlternatives: number = 1;
  continuous: boolean = false;

  #interimResults: boolean = false;

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
  androidIntent?: string = undefined;
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
  #subscriptionMap: Map<Function, Subscription[]> = new Map();

  start() {
    ExpoSpeechRecognitionModule.start({
      lang: this.lang,
      interimResults: this.interimResults,
      maxAlternatives: this.maxAlternatives,
      contextualStrings: this.contextualStrings,
      requiresOnDeviceRecognition: this.requiresOnDeviceRecognition,
      addsPunctuation: this.addsPunctuation,
      continuous: this.continuous,
      androidIntentOptions: this.androidIntentOptions,
      androidRecognitionServicePackage: this.androidRecognitionServicePackage,
      audioSource: this.audioSource,
    });
  }
  stop = ExpoSpeechRecognitionModule.stop;
  abort = ExpoSpeechRecognitionModule.stop;

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

  #onaudioend: SpeechListener<"audioend"> | null = null;
  set onaudioend(listener: SpeechListener<"audioend"> | null) {
    this._setListeners("audioend", listener, this.#onaudioend);
    this.#onaudioend = listener;
  }
  get onaudioend() {
    return this.#onaudioend;
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

  /** [TODO] Fired when the user agent has finished capturing audio. */
  // onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null = null;
  /** [TODO] Fired when the user agent has started to capture audio. */
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null = null;
  /** [TODO] */
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null = null;
  /** [TODO] */
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null = null;

  addEventListener<K extends keyof SpeechRecognitionEventMap>(
    type: K,
    listener: (
      this: SpeechRecognition,
      ev: SpeechRecognitionEventMap[K],
    ) => any,
  ): void {
    // Enhance the native listener with any necessary polyfills
    const enhancedEvents: NativeEventAndListener[] = WebListenerTransformers[
      type
    ]?.(this, listener) ?? [{ eventName: type, nativeListener: listener }];

    const subscriptions = enhancedEvents.map(
      ({ eventName, nativeListener }) => {
        return ExpoSpeechRecognitionModuleEmitter.addListener(
          eventName,
          nativeListener,
        );
      },
    );

    // Store the subscriptions so we can remove them later
    // This is keyed by the listener function so we can remove all subscriptions for a given listener
    this.#subscriptionMap.set(listener, subscriptions);
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
      subscriptions.forEach((subscription) => subscription.remove());
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
export class ExpoSpeechGrammarList implements SpeechGrammarList {
  get length() {
    return this.#grammars.length;
  }
  #grammars: ExpoSpeechGrammar[] = [];
  [index: number]: SpeechGrammar; // Indexer property

  addFromURI(src: string, weight?: number | undefined): void {
    // todo
  }

  item(index: number): ExpoSpeechGrammar {
    return this.#grammars[index];
  }

  addFromString = (grammar: string, weight?: number) => {
    // TODO: parse grammar to html entities (data:application/xml,....)
    this.#grammars.push(new ExpoSpeechGrammar(grammar, weight));
    // Set key on this object for compatibility with web SpeechGrammarList API
    this[this.length - 1] = this.#grammars[this.length - 1];
  };
}

export class ExpoSpeechGrammar implements SpeechGrammar {
  src: string = "";
  weight: number = 1;

  constructor(src: string, weight?: number) {
    this.src = src;
    this.weight = weight ?? 1;
  }
}

class ExpoSpeechRecognitionResultList implements SpeechRecognitionResultList {
  #results: ExpoSpeechRecognitionResult[] = [];

  [Symbol.iterator](): IterableIterator<ExpoSpeechRecognitionResult> {
    return this.#results[Symbol.iterator]();
  }
  get length(): number {
    return this.#results.length;
  }
  item(index: number): SpeechRecognitionResult {
    return this.#results[index];
  }
  [index: number]: SpeechRecognitionResult;

  constructor(results: ExpoSpeechRecognitionResult[]) {
    this.#results = results;

    return new Proxy(this, {
      get(target, prop) {
        if (typeof prop === "string" && !isNaN(Number(prop))) {
          return target.item(Number(prop));
        }
        return (target as any)[prop];
      },
    });
  }
}

class ExpoSpeechRecognitionResult implements SpeechRecognitionResult {
  #alternatives: ExpoSpeechRecognitionAlternative[] = [];
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SpeechRecognitionResult/isFinal) */
  readonly isFinal: boolean;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SpeechRecognitionResult/length) */
  get length(): number {
    return this.#alternatives.length;
  }
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SpeechRecognitionResult/item) */
  item(index: number): SpeechRecognitionAlternative {
    return this.#alternatives[index];
  }
  [index: number]: SpeechRecognitionAlternative;
  [Symbol.iterator](): IterableIterator<SpeechRecognitionAlternative> {
    return this.#alternatives[Symbol.iterator]();
  }

  constructor(
    isFinal: boolean,
    alternatives: ExpoSpeechRecognitionAlternative[],
  ) {
    this.isFinal = isFinal;
    this.#alternatives = alternatives;

    return new Proxy(this, {
      get(target, prop) {
        if (typeof prop === "string" && !isNaN(Number(prop))) {
          return target.item(Number(prop));
        }
        return (target as any)[prop];
      },
    });
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
