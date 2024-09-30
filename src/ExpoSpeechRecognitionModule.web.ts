import type { PermissionResponse } from "expo-modules-core";
import type {
  ExpoSpeechRecognitionModuleType,
  ExpoSpeechRecognitionNativeEventMap,
} from "./ExpoSpeechRecognitionModule.types";

let _speechRecognitionRef: SpeechRecognition | null = null;

// It loads the native module object from the JSI or falls back to
// the bridge module (from NativeModulesProxy) if the remote debugger is on.
export const ExpoSpeechRecognitionModule: ExpoSpeechRecognitionModuleType = {
  start: (options) => {
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
    ExpoSpeechRecognitionModuleEmitter._nativeListeners.forEach(
      (listeners, eventName) => {
        for (const listener of listeners) {
          // May already be subscribed
          _speechRecognitionRef?.removeEventListener(eventName, listener);
          _speechRecognitionRef?.addEventListener(eventName, listener);
        }
      },
    );

    // Start the speech recognition!
    _speechRecognitionRef.start();
  },
  getStateAsync: () => {
    console.warn(
      "getStateAsync is not supported on web. Returning 'inactive'.",
    );
    return Promise.resolve("inactive");
  },
  stop: () => _speechRecognitionRef?.stop(),
  abort: () => _speechRecognitionRef?.abort(),
  requestPermissionsAsync: () => {
    return Promise.resolve({
      granted: true,
      canAskAgain: false,
      expires: "never",
      status: "granted",
    } as PermissionResponse);
  },
  getPermissionsAsync: () => {
    console.warn(
      "getPermissionsAsync is not supported on web. Returning a denied permission response.",
    );
    return Promise.resolve({
      granted: false,
      canAskAgain: false,
      expires: "never",
      status: "denied",
    } as PermissionResponse);
  },
  getSupportedLocales: async () => {
    console.warn(
      "getSupportedLocales is not supported on web. Returning an empty array.",
    );
    return {
      locales: [] as string[],
      installedLocales: [] as string[],
    };
  },
  addListener: () => {
    console.warn(
      "addListener is not supported. Use ExpoSpeechRecognitionModuleEmitter(eventName, listener) instead.",
    );
  },
  removeListeners: () => {
    console.warn(
      "removeListeners is not supported. Use ExpoSpeechRecognitionModuleEmitter.removeListener(eventName, listener) instead.",
    );
  },
  getSpeechRecognitionServices: () => {
    return [] as string[];
  },
  getDefaultRecognitionService: () => {
    return {
      packageName: "",
    };
  },
  getAssistantService: () => {
    return {
      packageName: "",
    };
  },
  supportsOnDeviceRecognition: () => {
    return false;
  },
  supportsRecording: () => {
    return false;
  },
  androidTriggerOfflineModelDownload: () => {
    console.warn(
      "androidTriggerOfflineModelDownload is not supported on web. Returning false.",
    );
    return Promise.resolve({
      status: "opened_dialog",
      message: "Offline model download is not supported on web.",
    });
  },
  setCategoryIOS: () => {
    console.warn("setCategoryIOS is not supported on web.");
  },
  getAudioSessionCategoryAndOptionsIOS: () => {
    console.warn(
      "getAudioSessionCategoryAndOptionsIOS is not supported on web.",
    );
    return {
      category: "playAndRecord",
      categoryOptions: ["defaultToSpeaker", "allowBluetooth"],
      mode: "measurement",
    };
  },
  setAudioSessionActiveIOS: () => {
    console.warn("setAudioSessionActiveIOS is not supported on web.");
  },
  isRecognitionAvailable: () => {
    const hasSpeechRecognitionAPI =
      typeof webkitSpeechRecognition !== "undefined" ||
      typeof SpeechRecognition !== "undefined";

    return hasSpeechRecognitionAPI;
  },
};

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
  result: (ev) => {
    const nativeResults: ExpoSpeechRecognitionNativeEventMap["result"]["results"] =
      [];

    for (let i = 0; i < ev.results[ev.resultIndex].length; i++) {
      const result = ev.results[ev.resultIndex][i];
      nativeResults.push({
        transcript: result.transcript,
        confidence: result.confidence,
        segments: [],
      });
    }

    return {
      isFinal: Boolean(ev.results[ev.resultIndex]?.isFinal),
      results: nativeResults,
    };
  },
  soundstart: (ev) => null,
  speechend: (ev) => null,
  speechstart: (ev) => null,
  start: (ev) => null,
  soundend: (ev) => null,
};

export const ExpoSpeechRecognitionModuleEmitter = {
  _nativeListeners: new Map() as Map<string, Set<(event: any) => void>>,
  _clientListeners: new Map() as Map<
    // Original listener
    (event: any) => void,
    // Native listener
    (event: any) => void
  >,
  addListener<T extends keyof SpeechRecognitionEventMap>(
    eventName: T,
    listener: (ev: ExpoSpeechRecognitionNativeEventMap[T]) => void,
  ) {
    // Convert the web event to the native event
    const nativeListener = (ev: SpeechRecognitionEventMap[T]) => {
      const eventPayload = webToNativeEventMap[eventName]?.(ev);
      listener(eventPayload);
    };

    _speechRecognitionRef?.addEventListener(eventName, nativeListener);
    if (!ExpoSpeechRecognitionModuleEmitter._nativeListeners.has(eventName)) {
      ExpoSpeechRecognitionModuleEmitter._nativeListeners.set(
        eventName,
        new Set(),
      );
    }
    // Add the original listener to the enhanced listeners
    ExpoSpeechRecognitionModuleEmitter._nativeListeners
      .get(eventName)
      ?.add(nativeListener);

    // Map the original listener to the enhanced listener
    ExpoSpeechRecognitionModuleEmitter._clientListeners.set(
      listener,
      nativeListener,
    );

    return {
      remove: () => {
        _speechRecognitionRef?.removeEventListener(eventName, nativeListener);
        ExpoSpeechRecognitionModuleEmitter._nativeListeners
          .get(eventName)
          ?.delete(nativeListener);
        ExpoSpeechRecognitionModuleEmitter._clientListeners.delete(listener);
      },
    };
  },
  removeListener: (eventName: string, listener: (event: any) => void) => {
    const resolvedListener =
      ExpoSpeechRecognitionModuleEmitter._clientListeners.get(listener) ??
      listener;

    _speechRecognitionRef?.removeEventListener(eventName, resolvedListener);
    if (ExpoSpeechRecognitionModuleEmitter._nativeListeners.has(eventName)) {
      ExpoSpeechRecognitionModuleEmitter._nativeListeners
        .get(eventName)
        ?.delete(listener);
    }
    ExpoSpeechRecognitionModuleEmitter._clientListeners.delete(listener);
  },
  removeAllListeners: (eventName: string) => {
    // Go through _listeners and remove all listeners for this event
    if (ExpoSpeechRecognitionModuleEmitter._nativeListeners.has(eventName)) {
      const nativeListeners =
        ExpoSpeechRecognitionModuleEmitter._nativeListeners.get(eventName);
      if (!nativeListeners) {
        return;
      }

      // Remove the enhanced listeners
      for (const [
        listener,
        nativeListener,
      ] of ExpoSpeechRecognitionModuleEmitter._clientListeners) {
        // if nativeListener in listeners, remove it
        if (nativeListeners.has(nativeListener)) {
          // Remove the enhanced listener
          ExpoSpeechRecognitionModuleEmitter._clientListeners.delete(listener);
        }
      }

      // Remove the native listeners
      for (const listener of nativeListeners) {
        ExpoSpeechRecognitionModuleEmitter.removeListener(eventName, listener);
      }

      // Clean up
      ExpoSpeechRecognitionModuleEmitter._nativeListeners.delete(eventName);
    }
  },
};
