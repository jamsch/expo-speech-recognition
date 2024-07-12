import { useEffect, useRef, useSyncExternalStore } from "react";
import { ExpoSpeechRecognition } from "./ExpoSpeechRecognition";
import { ExpoSpeechRecognitionOptions } from "./ExpoSpeechRecognitionModule.types";

function createStoreApi<S>(initialState: S) {
  let state = initialState;
  const subscribers = new Set<() => void>();
  return {
    subscribe: (listener: () => void) => {
      subscribers.add(listener);
      return () => {
        subscribers.delete(listener);
      };
    },
    getState: () => state,
    setState(newState: Partial<S>) {
      const incomingState = { ...state, ...newState };
      // Check shallow equality
      if (JSON.stringify(state) === JSON.stringify(incomingState)) {
        return;
      }
      state = incomingState;
      subscribers.forEach((listener) => listener());
    },
  };
}

/**
 * This function creates a new `ExpoSpeechRecognizer` instance
 * and returns a `useEvent` hook that you can use to register event listeners, and start/stop functions.
 */
export const createSpeechRecognizer = (
  options: Partial<ExpoSpeechRecognitionOptions> = {},
) => {
  const recognition = new ExpoSpeechRecognition();

  const optionsStore =
    createStoreApi<Partial<ExpoSpeechRecognitionOptions>>(options);

  const configure = (options: Partial<ExpoSpeechRecognitionOptions> = {}) => {
    const newOptions = { ...optionsStore.getState(), ...options };
    recognition.lang = newOptions.lang ?? "en-US";
    recognition.interimResults = newOptions.interimResults ?? true;
    recognition.maxAlternatives = newOptions.maxAlternatives ?? 1;
    recognition.continuous = newOptions.continuous ?? false;
    recognition.requiresOnDeviceRecognition =
      newOptions.requiresOnDeviceRecognition ?? false;
    recognition.addsPunctuation = newOptions.addsPunctuation ?? false;
    recognition.contextualStrings = newOptions.contextualStrings ?? [];
    recognition.androidIntentOptions = newOptions.androidIntentOptions;
    recognition.androidRecognitionServicePackage =
      newOptions.androidRecognitionServicePackage;
    recognition.androidIntent = newOptions.androidIntent;
    optionsStore.setState(newOptions);
  };

  // Configure the recognizer with the options
  configure(options);

  return {
    recognition,
    start: (options: Partial<ExpoSpeechRecognitionOptions> = {}) => {
      // Re-configure the recognizer with the new options
      configure(options);
      recognition.start();
    },
    stop: () => recognition.stop(),
    useEvent<K extends keyof SpeechRecognitionEventMap>(
      eventName: K,
      listener: (
        this: SpeechRecognition,
        ev: SpeechRecognitionEventMap[K],
      ) => any,
    ) {
      const listenerRef = useRef(listener);
      listenerRef.current = listener;

      const options = useSyncExternalStore(
        optionsStore.subscribe,
        optionsStore.getState,
      );

      // Hack: re-subscribe to the event if the interimResults option changes
      const shouldRevalidateResultsListener =
        eventName === "result" ? options.interimResults : null;

      useEffect(() => {
        const handler = listenerRef.current;
        recognition.addEventListener(eventName, handler);
        return () => recognition.removeEventListener(eventName, handler);
      }, [shouldRevalidateResultsListener, eventName, listenerRef]);
    },
  };
};

export function useSpeechRecognitionEvent<
  K extends keyof SpeechRecognitionEventMap,
>(
  recognizer: ExpoSpeechRecognition,
  eventName: K,
  listener: (this: SpeechRecognition, ev: SpeechRecognitionEventMap[K]) => any,
) {
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    const handler = listenerRef.current;
    recognizer.addEventListener(eventName, handler);
    return () => recognizer.removeEventListener(eventName, handler);
  }, [recognizer, eventName, listenerRef]);
}
