import { useEffect, useRef } from "react";
import { ExpoSpeechRecognitionModuleEmitter } from "./ExpoSpeechRecognitionModule";
import type { ExpoSpeechRecognitionNativeEventMap } from "./ExpoSpeechRecognitionModule.types";

/**
 * This hook allows you to listen to native events emitted by the `ExpoSpeechRecognitionModule`.
 *
 * Note: this is not the same as the `SpeechRecognition` event listener on the web speech API.
 *
 * @param eventName The name of the event to listen to
 * @param listener The listener function to call when the event is emitted
 */
export function useSpeechRecognitionEvent<
  K extends keyof ExpoSpeechRecognitionNativeEventMap,
>(
  eventName: K,
  listener: (ev: ExpoSpeechRecognitionNativeEventMap[K]) => void,
) {
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    const handler = listenerRef.current;
    const subscription = ExpoSpeechRecognitionModuleEmitter.addListener(
      eventName,
      handler,
    );
    return subscription.remove;
  }, [eventName]);
}
