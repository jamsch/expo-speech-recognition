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
 *
 * Call {@link dispose} to stop listening early (e.g. on React unmount).
 * Terminal events (`success`, `error`, `scheduled`) dispose automatically.
 */
export class AndroidModelDownloadHandle {
  #listeners = new Map<EventKey, Set<(value: never) => void>>();
  #teardown: (() => void) | null = null;
  #disposed = false;

  get disposed(): boolean {
    return this.#disposed;
  }

  /** @internal */
  _bindTeardown(teardown: () => void) {
    this.#teardown = teardown;
  }

  on<K extends EventKey>(
    event: K,
    listener: (value: AndroidModelDownloadEventMap[K]) => void,
  ): this {
    if (this.#disposed) return this;
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

  /**
   * Stops listening for download updates and clears all `.on` listeners.
   * Safe to call multiple times. Invoked automatically after terminal events
   * (`success`, `error`, `scheduled`).
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#listeners.clear();
    const teardown = this.#teardown;
    this.#teardown = null;
    teardown?.();
  }

  /** @internal */
  _emit<K extends EventKey>(event: K, value: AndroidModelDownloadEventMap[K]) {
    if (this.#disposed) return;
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
 * Returns a handle you can attach listeners to.
 *
 * **Android 14+ events**
 * - `progress` — download started; may fire zero or more times, then `success`
 * - `success` — model is installed and ready (or was already available)
 * - `scheduled` — Android queued the download for later (e.g. waiting for Wi‑Fi).
 *   This is terminal: you will **not** get `progress` / `success` / `error` on
 *   this handle. Poll {@link ExpoSpeechRecognitionModule.getSupportedLocales}
 *   later to see when the model is installed.
 * - `error` — download failed
 *
 * **Android 13 only:** emits `opened_dialog` when the system dialog is shown
 * (fire-and-forget — no further events; handle is disposed). `success` still
 * fires if the locale is already installed.
 *
 * Terminal events (`success`, `error`, `scheduled`) dispose the handle
 * automatically. Call {@link AndroidModelDownloadHandle.dispose} to abort
 * listening early (e.g. component unmount).
 *
 * @example
 * ```ts
 * const download = downloadAndroidOfflineModel("en-US")
 *   .on("progress", (progress) => console.log(progress))
 *   .on("scheduled", () =>
 *     console.log("Queued for later — no further events; check getSupportedLocales()"),
 *   )
 *   .on("success", () => console.log("done"))
 *   .on("error", (code) => console.error(code))
 *   // Android 13 only — fire-and-forget system dialog
 *   .on("opened_dialog", () => console.log("complete the system dialog"));
 *
 * // Later / on unmount:
 * download.dispose();
 * ```
 */
export function downloadAndroidOfflineModel(
  locale: string,
): AndroidModelDownloadHandle {
  const handle = new AndroidModelDownloadHandle();

  const subscription = ExpoSpeechRecognitionModule.addListener(
    "modelDownloadUpdate",
    (e) => {
      if (e.locale !== locale || handle.disposed) return;
      switch (e.status) {
        case "download_scheduled":
          // Android: no further updates on this listener after onScheduled().
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

  handle._bindTeardown(() => {
    subscription.remove();
  });

  const finish = <K extends EventKey>(
    event: K,
    value: AndroidModelDownloadEventMap[K],
  ) => {
    if (handle.disposed) return;
    handle._emit(event, value);
    handle.dispose();
  };

  void ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({
    locale,
  })
    .then(async (result) => {
      if (handle.disposed) return;

      if (result.status === "opened_dialog") {
        handle._emit("opened_dialog", undefined);
      } else if (result.status === "download_success") {
        finish("success", undefined);
        return;
      } else if (result.status === "download_scheduled") {
        // Android: no further updates on this listener after onScheduled().
        finish("scheduled", undefined);
        return;
      }

      try {
        const { installedLocales } =
          await ExpoSpeechRecognitionModule.getSupportedLocales({});
        if (handle.disposed) return;
        if (installedLocales.includes(locale)) {
          finish("success", undefined);
          return;
        }
      } catch {
        // ignore — install state unknown
      }

      // Android 13: dialog shown, model not installed yet — stop listening.
      if (result.status === "opened_dialog") {
        handle.dispose();
      }
    })
    .catch((err: unknown) => {
      finish("error", rejectCodeToError(err));
    });

  return handle;
}
