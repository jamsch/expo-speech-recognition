---
"expo-speech-recognition": patch
---

Added `downloadAndroidOfflineModel` with event emitters to listen to model download status. The handle exposes `dispose()` to stop listening early; terminal events dispose automatically.

```ts
import { downloadAndroidOfflineModel } from "expo-speech-recognition";

const download = downloadAndroidOfflineModel("en-US")
  .on("progress", (progress) => console.log(`Downloading... ${progress}%`))
  // Android queued the download for later (e.g. waiting for Wi‑Fi).
  .on("scheduled", () => console.log("Download queued for later"))
  .on("success", () => console.log("Model installed"))
  .on("error", (code) => console.error("Download failed", code))
  // Android 13 only — fire-and-forget: system dialog shown, no further events.
  .on("opened_dialog", () =>
    console.log("Complete the download in the system dialog"),
  );

// Optional: stop listening early (e.g. effect cleanup on unmount).
// `success` / `error` / `scheduled` dispose the handle automatically.
download.dispose();
```
