import { beforeEach, expect, it, jest } from "@jest/globals";

import { ExpoSpeechRecognitionModule } from "../ExpoSpeechRecognitionModule";
import { downloadAndroidOfflineModel } from "../androidOfflineModelDownload";

jest.mock("../ExpoSpeechRecognitionModule", () => ({
  ExpoSpeechRecognitionModule: {
    addListener: jest.fn(),
    androidTriggerOfflineModelDownload: jest.fn(),
    getSupportedLocales: jest.fn(),
  },
}));

type ModelDownloadEvent = {
  locale: string;
  requestId: string;
  status:
    | "download_scheduled"
    | "download_progress"
    | "download_success"
    | "download_error";
  progress?: number;
  error?: number;
};

type JestMock = ReturnType<typeof jest.fn>;

const addListenerMock =
  ExpoSpeechRecognitionModule.addListener as unknown as JestMock;
const triggerDownloadMock =
  ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload as unknown as JestMock;
const getSupportedLocalesMock =
  ExpoSpeechRecognitionModule.getSupportedLocales as unknown as JestMock;

let nativeListeners: Array<(event: ModelDownloadEvent) => void>;
let removeMocks: JestMock[];

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function getTriggeredRequest(index: number): { requestId: string } {
  const call = triggerDownloadMock.mock.calls[index];
  if (!call) {
    throw new Error(`Missing trigger call at index ${index}`);
  }
  return call[0] as { requestId: string };
}

beforeEach(() => {
  jest.clearAllMocks();
  nativeListeners = [];
  removeMocks = [];

  addListenerMock.mockImplementation(
    (_eventName: string, listener: (event: ModelDownloadEvent) => void) => {
      const remove = jest.fn();
      nativeListeners.push(listener);
      removeMocks.push(remove);
      return { remove };
    },
  );
  triggerDownloadMock.mockImplementation(() => new Promise(() => {}));
  getSupportedLocalesMock.mockResolvedValue({
    locales: [],
    installedLocales: [],
  });
});

it("isolates concurrent downloads for the same locale", () => {
  const firstSuccess = jest.fn();
  const secondSuccess = jest.fn();
  const first = downloadAndroidOfflineModel("en-US").on(
    "success",
    firstSuccess,
  );
  const second = downloadAndroidOfflineModel("en-US").on(
    "success",
    secondSuccess,
  );
  const firstRequest = getTriggeredRequest(0);

  const event: ModelDownloadEvent = {
    locale: "en-US",
    requestId: firstRequest.requestId,
    status: "download_success",
  };
  nativeListeners[0]?.(event);
  nativeListeners[1]?.(event);

  expect(firstSuccess).toHaveBeenCalledTimes(1);
  expect(secondSuccess).not.toHaveBeenCalled();
  expect(first.disposed).toBe(true);
  expect(second.disposed).toBe(false);
});

it("emits success instead of opened_dialog when the Android 13 model is already installed", async () => {
  triggerDownloadMock.mockResolvedValue({
    status: "opened_dialog",
    message: "Opened the model download dialog.",
  });
  getSupportedLocalesMock.mockResolvedValue({
    locales: ["en-US"],
    installedLocales: ["en-US"],
  });
  const onOpenedDialog = jest.fn();
  const onSuccess = jest.fn();

  const handle = downloadAndroidOfflineModel("en-US")
    .on("opened_dialog", onOpenedDialog)
    .on("success", onSuccess);
  await flushPromises();

  expect(onOpenedDialog).not.toHaveBeenCalled();
  expect(onSuccess).toHaveBeenCalledTimes(1);
  expect(handle.disposed).toBe(true);
});

it("treats opened_dialog as terminal when the model is not installed", async () => {
  triggerDownloadMock.mockResolvedValue({
    status: "opened_dialog",
    message: "Opened the model download dialog.",
  });
  const onOpenedDialog = jest.fn();
  const onSuccess = jest.fn();

  const handle = downloadAndroidOfflineModel("en-US")
    .on("opened_dialog", onOpenedDialog)
    .on("success", onSuccess);
  await flushPromises();

  expect(onOpenedDialog).toHaveBeenCalledTimes(1);
  expect(onSuccess).not.toHaveBeenCalled();
  expect(handle.disposed).toBe(true);
  expect(removeMocks[0]).toHaveBeenCalledTimes(1);
});

it("parses legacy low-level Android error codes", async () => {
  triggerDownloadMock.mockRejectedValue({ code: "error_7" });
  const onError = jest.fn();

  downloadAndroidOfflineModel("en-US").on("error", onError);
  await flushPromises();

  expect(onError).toHaveBeenCalledWith(7);
});

it("parses numeric low-level Android error codes", async () => {
  triggerDownloadMock.mockRejectedValue({ code: "7" });
  const onError = jest.fn();

  downloadAndroidOfflineModel("en-US").on("error", onError);
  await flushPromises();

  expect(onError).toHaveBeenCalledWith(7);
});

it("disposes after a terminal event even when a listener throws", () => {
  const handle = downloadAndroidOfflineModel("en-US").on("success", () => {
    throw new Error("listener failed");
  });
  const request = getTriggeredRequest(0);

  expect(() =>
    nativeListeners[0]?.({
      locale: "en-US",
      requestId: request.requestId,
      status: "download_success",
    }),
  ).toThrow("listener failed");
  expect(handle.disposed).toBe(true);
  expect(removeMocks[0]).toHaveBeenCalledTimes(1);
});
