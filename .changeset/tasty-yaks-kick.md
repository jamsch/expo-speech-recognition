---
"expo-speech-recognition": patch
---

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
// `success` / `error` / `scheduled` dispose the handle automatically.
download.dispose();
```
