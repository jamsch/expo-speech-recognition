import { PermissionResponse } from "expo-modules-core";
import type { ExpoSpeechRecognitionModuleType } from "./ExpoSpeechRecognitionModule.types";

let _speechRecognitionRef: SpeechRecognition | null = null;

// It loads the native module object from the JSI or falls back to
// the bridge module (from NativeModulesProxy) if the remote debugger is on.
export const ExpoSpeechRecognitionModule: ExpoSpeechRecognitionModuleType = {
  start: (options) => {
    _speechRecognitionRef = new SpeechRecognition();
    _speechRecognitionRef.lang = options.lang;
    _speechRecognitionRef.interimResults = options.interimResults;
    _speechRecognitionRef.maxAlternatives = options.maxAlternatives;
    _speechRecognitionRef.continuous = options.continuous;

    // Re-subscribe to events so that we don't lose them
    // This covers the case where the user has already subscribed to an event prior to calling `start()`
    ExpoSpeechRecognitionModuleEmitter._listeners.forEach(
      (listeners, eventName) => {
        listeners.forEach((listener) => {
          // May already be subscribed
          _speechRecognitionRef?.removeEventListener(eventName, listener);
          _speechRecognitionRef?.addEventListener(eventName, listener);
        });
      },
    );

    // Start the speech recognition!
    _speechRecognitionRef.start();
  },
  stop: () => _speechRecognitionRef?.stop(),
  requestPermissionsAsync: () => {
    console.warn(
      "requestPermissionsAsync is not supported on the web. Returning a granted permission response.",
    );
    return Promise.resolve({
      granted: true,
      canAskAgain: false,
      expires: "never",
      status: "granted",
    } as PermissionResponse);
  },
  getSupportedLocales: async () => {
    console.warn(
      "getSupportedLocales is not supported on the web. Returning an empty array.",
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
    console.warn(
      "getSpeechRecognitionServices is not supported on the web. Returning an empty array.",
    );
    return [] as string[];
  },
  isOnDeviceRecognitionAvailable: () => {
    console.warn(
      "isOnDeviceRecognitionAvailable is not supported on the web. Returning false.",
    );
    return false;
  },
  androidTriggerOfflineModelDownload: () => {
    console.warn(
      "androidTriggerOfflineModelDownload is not supported on the web. Returning false.",
    );
    return Promise.resolve(false);
  },
  setCategoryIOS: () => {
    console.warn("setCategoryIOS is not supported on the web.");
  },
  getAudioSessionCategoryAndOptionsIOS: () => {
    console.warn(
      "getAudioSessionCategoryAndOptionsIOS is not supported on the web.",
    );
    return {
      category: "playAndRecord",
      categoryOptions: ["defaultToSpeaker", "allowBluetooth"],
      mode: "measurement",
    };
  },
};

export const ExpoSpeechRecognitionModuleEmitter = {
  _listeners: new Map() as Map<string, Set<() => void>>,
  addListener: (eventName: string, listener: () => void) => {
    _speechRecognitionRef?.addEventListener(eventName, listener);
    if (!ExpoSpeechRecognitionModuleEmitter._listeners.has(eventName)) {
      ExpoSpeechRecognitionModuleEmitter._listeners.set(eventName, new Set());
    }
    ExpoSpeechRecognitionModuleEmitter._listeners.get(eventName)?.add(listener);

    return {
      remove: () => {
        _speechRecognitionRef?.removeEventListener(eventName, listener);
      },
    };
  },
  removeListener: (eventName: string, listener: () => void) => {
    _speechRecognitionRef?.removeEventListener(eventName, listener);
    if (ExpoSpeechRecognitionModuleEmitter._listeners.has(eventName)) {
      ExpoSpeechRecognitionModuleEmitter._listeners
        .get(eventName)
        ?.delete(listener);
    }
  },
  removeAllListeners: (eventName: string) => {
    // Go through _listeners and remove all listeners for this event
    if (ExpoSpeechRecognitionModuleEmitter._listeners.has(eventName)) {
      const listeners =
        ExpoSpeechRecognitionModuleEmitter._listeners.get(eventName);
      if (!listeners) {
        return;
      }
      listeners.forEach((listener) =>
        ExpoSpeechRecognitionModuleEmitter.removeListener(eventName, listener),
      );
      ExpoSpeechRecognitionModuleEmitter._listeners.delete(eventName);
    }
  },
};
