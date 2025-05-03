import type { EventSubscription, PermissionResponse } from "expo-modules-core";
import { registerWebModule, NativeModule } from "expo";
import type {
  ExpoSpeechRecognitionNativeEventMap,
  ExpoSpeechRecognitionNativeEvents,
  ExpoSpeechRecognitionOptions,
  ExpoSpeechRecognitionResultSegment,
} from "./ExpoSpeechRecognitionModule.types";

let _speechRecognitionRef: SpeechRecognition | null = null;

type NativeEventListener = (
  event: SpeechRecognitionEventMap[keyof SpeechRecognitionEventMap],
) => void;

// It loads the native module object from the JSI or falls back to
// the bridge module (from NativeModulesProxy) if the remote debugger is on.
class ExpoSpeechRecognitionModuleWeb extends NativeModule<ExpoSpeechRecognitionNativeEvents> {
  _clientListeners: Map<
    // Original listener
    ExpoSpeechRecognitionNativeEvents[keyof ExpoSpeechRecognitionNativeEvents],
    // Native listener
    NativeEventListener
  > = new Map();

  _nativeListeners: Map<string, Set<NativeEventListener>> = new Map();

  // Convert the web event to the native event
  bindEventListener = <T extends keyof SpeechRecognitionEventMap>(
    eventName: T,
    ev: SpeechRecognitionEventMap[T],
  ) => {
    const eventPayload = webToNativeEventMap[eventName]?.(ev);

    this.emit(
      eventName,
      // @ts-expect-error payload typings are incorrect
      eventPayload,
    );
  };

  addListener<EventName extends keyof ExpoSpeechRecognitionNativeEventMap>(
    eventName: EventName,
    listener: ExpoSpeechRecognitionNativeEvents[EventName],
  ): EventSubscription {
    // Convert the web event to the native event

    // @ts-expect-error Not all events are covered here
    const nativeListener = (ev: SpeechRecognitionEventMap[EventName]) => {
      const handler =
        eventName in webToNativeEventMap
          ? webToNativeEventMap[eventName as keyof SpeechRecognitionEventMap]
          : null;

      // @ts-expect-error payload typings are incorrect
      const eventPayload = handler?.(ev);

      // @ts-expect-error
      listener(eventPayload);
    };

    // @ts-expect-error
    _speechRecognitionRef?.addEventListener(eventName, nativeListener);
    if (!this._nativeListeners.has(eventName)) {
      this._nativeListeners.set(eventName, new Set());
    }
    // Add the original listener to the enhanced listeners
    // @ts-expect-error
    this._nativeListeners.get(eventName)?.add(nativeListener);
    // Map the original listener to the enhanced listener
    // @ts-expect-error
    this._clientListeners.set(listener, nativeListener);

    const handle = super.addListener(eventName, listener);

    return {
      remove: () => {
        // @ts-expect-error
        this._nativeListeners.get(eventName)?.delete(nativeListener);
        this._clientListeners.delete(listener);
        handle.remove();
      },
    };
  }

  removeAllListeners(
    eventName: keyof ExpoSpeechRecognitionNativeEventMap,
  ): void {
    // Go through _listeners and remove all listeners for this event
    if (this._nativeListeners.has(eventName)) {
      const nativeListeners = this._nativeListeners.get(eventName);
      if (!nativeListeners) {
        return;
      }

      // Remove the enhanced listeners
      for (const [listener, nativeListener] of this._clientListeners) {
        // if nativeListener in listeners, remove it
        if (nativeListeners.has(nativeListener)) {
          // Remove the enhanced listener
          this.removeListener(eventName, listener);
        }
      }

      // ...and the native listeners
      for (const listener of nativeListeners) {
        // @ts-expect-error
        this.removeListener(eventName, listener);
      }

      // Clean up
      this._nativeListeners.delete(eventName);
    }
  }

  start(options: ExpoSpeechRecognitionOptions) {
    const SpeechRecognitionClass =
      typeof webkitSpeechRecognition !== "undefined"
        ? webkitSpeechRecognition
        : SpeechRecognition;
    _speechRecognitionRef = new SpeechRecognitionClass();
    _speechRecognitionRef.lang = options.lang ?? "en-US";
    _speechRecognitionRef.interimResults = options.interimResults ?? false;
    _speechRecognitionRef.maxAlternatives = options.maxAlternatives ?? 1;
    _speechRecognitionRef.continuous = options.continuous ?? false;

    // Re-subscribe to events so that we don't lose them
    // This covers the case where the user has already subscribed to an event prior to calling `start()`
    this._nativeListeners.forEach((listeners, eventName) => {
      for (const listener of listeners) {
        // May already be subscribed
        _speechRecognitionRef?.removeEventListener(eventName, listener);
        _speechRecognitionRef?.addEventListener(eventName, listener);
      }
    });

    // Start the speech recognition!
    _speechRecognitionRef.start();
  }

  getStateAsync() {
    console.warn(
      "getStateAsync is not supported on web. Returning 'inactive'.",
    );
    return Promise.resolve("inactive");
  }

  stop() {
    _speechRecognitionRef?.stop();
  }
  abort() {
    _speechRecognitionRef?.abort();
  }

  requestPermissionsAsync() {
    console.warn(
      "requestPermissionsAsync is not supported on web. Returning a granted permission response.",
    );
    return Promise.resolve({
      granted: true,
      canAskAgain: false,
      expires: "never",
      status: "granted",
    } as PermissionResponse);
  }

  getPermissionsAsync() {
    console.warn(
      "getPermissionsAsync is not supported on web. Returning a granted permission response.",
    );
    return Promise.resolve({
      granted: true,
      canAskAgain: false,
      expires: "never",
      status: "granted",
    } as PermissionResponse);
  }

  getMicrophonePermissionsAsync() {
    console.warn(
      "getMicrophonePermissionsAsync is not supported on web. Returning a granted permission response.",
    );
    return Promise.resolve({
      granted: true,
      canAskAgain: false,
      expires: "never",
      status: "granted",
    } as PermissionResponse);
  }

  requestMicrophonePermissionsAsync() {
    console.warn(
      "requestMicrophonePermissionsAsync is not supported on web. Returning a granted permission response.",
    );
    return Promise.resolve({
      granted: true,
      canAskAgain: false,
      expires: "never",
      status: "granted",
    } as PermissionResponse);
  }

  getSpeechRecognizerPermissionsAsync() {
    console.warn(
      "getSpeechRecognizerPermissionsAsync is not supported on web. Returning a granted permission response.",
    );
    return Promise.resolve({
      granted: true,
      canAskAgain: false,
      expires: "never",
      status: "granted",
    } as PermissionResponse);
  }

  requestSpeechRecognizerPermissionsAsync() {
    console.warn(
      "requestSpeechRecognizerPermissionsAsync is not supported on web. Returning a granted permission response.",
    );
    return Promise.resolve({
      granted: true,
      canAskAgain: false,
      expires: "never",
      status: "granted",
    } as PermissionResponse);
  }

  async getSupportedLocales() {
    console.warn(
      "getSupportedLocales is not supported on web. Returning an empty array.",
    );
    return {
      locales: [] as string[],
      installedLocales: [] as string[],
    };
  }

  // addListener() {}

  // removeListeners() {}

  getSpeechRecognitionServices() {
    return [] as string[];
  }

  getDefaultRecognitionService() {
    return {
      packageName: "",
    };
  }

  getAssistantService() {
    return {
      packageName: "",
    };
  }

  supportsOnDeviceRecognition() {
    return false;
  }

  supportsRecording() {
    return false;
  }

  androidTriggerOfflineModelDownload() {
    console.warn(
      "androidTriggerOfflineModelDownload is not supported on web. Returning false.",
    );
    return Promise.resolve({
      status: "opened_dialog",
      message: "Offline model download is not supported on web.",
    });
  }

  setCategoryIOS() {
    console.warn("setCategoryIOS is not supported on web.");
  }

  getAudioSessionCategoryAndOptionsIOS() {
    console.warn(
      "getAudioSessionCategoryAndOptionsIOS is not supported on web.",
    );
    return {
      category: "playAndRecord",
      categoryOptions: ["defaultToSpeaker", "allowBluetooth"],
      mode: "measurement",
    };
  }

  setAudioSessionActiveIOS() {
    console.warn("setAudioSessionActiveIOS is not supported on web.");
  }

  isRecognitionAvailable() {
    const hasSpeechRecognitionAPI =
      typeof webkitSpeechRecognition !== "undefined" ||
      typeof SpeechRecognition !== "undefined";

    return hasSpeechRecognitionAPI;
  }
}

/**
 * Convert the web SpeechRecognitionEventMap to the native event map for compatibility
 */
const webToNativeEventMap: {
  [K in keyof SpeechRecognitionEventMap]: (
    ev: SpeechRecognitionEventMap[K],
  ) => ExpoSpeechRecognitionNativeEventMap[K];
} = {
  audioend: (ev) => ({ uri: null }),
  audiostart: (ev) => ({ uri: null }),
  end: (ev) => null,
  error: (ev) => ({ error: ev.error, message: ev.message }),
  nomatch: (ev) => null,
  result: (ev): ExpoSpeechRecognitionNativeEventMap["result"] => {
    const isFinal = Boolean(ev.results[ev.resultIndex]?.isFinal);

    if (isFinal) {
      const results: ExpoSpeechRecognitionNativeEventMap["result"]["results"] =
        [];

      for (let i = 0; i < ev.results[ev.resultIndex].length; i++) {
        const result = ev.results[ev.resultIndex][i];
        results.push({
          transcript: result.transcript,
          confidence: result.confidence,
          segments: [],
        });
      }
      return {
        isFinal: true,
        results,
      };
    }

    // Interim results: Append to the transcript
    let transcript = "";
    const segments: ExpoSpeechRecognitionResultSegment[] = [];

    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const resultList = ev.results[i];

      for (let j = 0; j < resultList.length; j++) {
        const result = resultList[j];
        if (!result) {
          continue;
        }
        segments.push({
          confidence: result.confidence,
          segment: result.transcript,
          startTimeMillis: 0,
          endTimeMillis: 0,
        });

        if (!isFinal) {
          transcript += result.transcript;
        }
      }
    }

    return {
      isFinal: false,
      results: [
        {
          transcript,
          confidence:
            segments.reduce((acc, curr) => acc + curr.confidence, 0) /
            segments.length,
          segments,
        },
      ],
    };
  },
  soundstart: (ev) => null,
  speechend: (ev) => null,
  speechstart: (ev) => null,
  start: (ev) => null,
  soundend: (ev) => null,
};

export const ExpoSpeechRecognitionModule = registerWebModule(
  ExpoSpeechRecognitionModuleWeb,
  "ExpoSpeechRecognitionModule",
);
