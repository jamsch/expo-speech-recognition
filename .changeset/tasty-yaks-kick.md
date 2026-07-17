---
"expo-speech-recognition": major
---

Support for Expo 57

Breaking: Changed Android recognizer rejection codes from `error_<number>` strings to numeric strings. Existing callers that inspect `error.code` should convert it with `Number(error.code)` before comparing it with `SpeechRecognizerErrorAndroid`.

Added `downloadAndroidOfflineModel` with event emitters to listen to model download status. The handle exposes `dispose()` to stop listening early; terminal events dispose automatically.

```ts
import { downloadAndroidOfflineModel } from "expo-speech-recognition";

const download = downloadAndroidOfflineModel("en-US")
  .on("progress", (progress) => console.log(`Downloading... ${progress}%`))
  .on("scheduled", () => console.log("Download queued for later (e.g. waiting for Wi-Fi)"))
  .on("success", () => console.log("Model installed"))
  .on("error", (code) => console.error("Download failed", code))
  .on("opened_dialog", () =>
    console.log("Complete the download in the system dialog (no further events)"),
  );

// Optional: stop listening early (e.g. effect cleanup on unmount).
// `success` / `error` / `scheduled` / `opened_dialog` dispose automatically.
download.dispose();
```
