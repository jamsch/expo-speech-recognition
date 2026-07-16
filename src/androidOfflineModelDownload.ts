import { SpeechRecognizerErrorAndroid } from "./constants";
import { ExpoSpeechRecognitionModule } from "./ExpoSpeechRecognitionModule";

export type AndroidModelDownloadEventMap = {
  progress: number;
  scheduled: undefined;
  success: undefined;
  error: number;
  opened_dialog: undefined;
};

type EventKey = keyof AndroidModelDownloadEventMap;

/**
 * Handle returned by {@link downloadAndroidOfflineModel}.
 * Chain `.on(...)` listeners; each `.on` returns the handle for fluency.
 */
export class AndroidModelDownloadHandle {
  #listeners = new Map<EventKey, Set<(value: never) => void>>();

  on<K extends EventKey>(
    event: K,
    listener: (value: AndroidModelDownloadEventMap[K]) => void,
  ): this {
    let set = this.#listeners.get(event);
    if (!set) {
      set = new Set();
      this.#listeners.set(event, set);
    }
    set.add(listener as (value: never) => void);
    return this;
  }

  off<K extends EventKey>(
    event: K,
    listener: (value: AndroidModelDownloadEventMap[K]) => void,
  ): this {
    this.#listeners.get(event)?.delete(listener as (value: never) => void);
    return this;
  }

  /** @internal */
  _emit<K extends EventKey>(event: K, value: AndroidModelDownloadEventMap[K]) {
    const set = this.#listeners.get(event);
    if (!set) return;
    for (const listener of set) {
      (listener as (value: AndroidModelDownloadEventMap[K]) => void)(value);
    }
  }
}

function rejectCodeToError(err: unknown): number {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  const numeric = Number(code);
  if (code !== "" && !Number.isNaN(numeric)) return numeric;
  return SpeechRecognizerErrorAndroid.ERROR_CLIENT;
}

/**
 * Downloads an Android offline speech recognition model for `locale`.
 *
 * Returns a handle you can attach listeners to. Only Android 14+ emits
 * `progress` / `scheduled`; Android 13 emits `opened_dialog` when the system
 * dialog is shown. `success` is emitted when the model is installed (including
 * when it was already available).
 *
 * @example
 * ```ts
 * downloadAndroidOfflineModel("en-US")
 *   .on("progress", (progress) => console.log(progress))
 *   .on("success", () => console.log("done"))
 *   .on("error", (code) => console.error(code))
 *   .on("opened_dialog", () => console.log("complete the system dialog"));
 * ```
 */
export function downloadAndroidOfflineModel(
  locale: string,
): AndroidModelDownloadHandle {
  const handle = new AndroidModelDownloadHandle();
  let settled = false;

  const finish = <K extends EventKey>(
    event: K,
    value: AndroidModelDownloadEventMap[K],
  ) => {
    if (settled) return;
    settled = true;
    handle._emit(event, value);
    subscription.remove();
  };

  const subscription = ExpoSpeechRecognitionModule.addListener(
    "modelDownloadUpdate",
    (e) => {
      if (e.locale !== locale || settled) return;
      switch (e.status) {
        case "download_scheduled":
          finish("scheduled", undefined);
          break;
        case "download_progress":
          handle._emit("progress", e.progress);
          break;
        case "download_success":
          finish("success", undefined);
          break;
        case "download_error":
          finish("error", e.error);
          break;
      }
    },
  );

  void ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({
    locale,
  })
    .then(async (result) => {
      if (settled) return;

      if (result.status === "opened_dialog") {
        handle._emit("opened_dialog", undefined);
      } else if (result.status === "download_success") {
        finish("success", undefined);
        return;
      } else if (result.status === "download_scheduled") {
        finish("scheduled", undefined);
        return;
      }

      try {
        const { installedLocales } =
          await ExpoSpeechRecognitionModule.getSupportedLocales({});
        if (installedLocales.includes(locale)) {
          finish("success", undefined);
          return;
        }
      } catch {
        // ignore — install state unknown
      }

      // Android 13: dialog shown, model not installed yet — stop listening.
      if (result.status === "opened_dialog") {
        settled = true;
        subscription.remove();
      }
    })
    .catch((err: unknown) => {
      finish("error", rejectCodeToError(err));
    });

  return handle;
}
