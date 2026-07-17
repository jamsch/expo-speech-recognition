---
"expo-speech-recognition": patch
---

Added `downloadAndroidOfflineModel` with event emitters to listen to model download status. The handle exposes `dispose()` to stop listening early; `success` / `error` dispose automatically.

```ts
import { downloadAndroidOfflineModel } from "expo-speech-recognition";

const download = downloadAndroidOfflineModel("en-US")
  .on("progress", (progress) => console.log(`Downloading... ${progress}%`))
  .on("scheduled", () => console.log("Download scheduled"))
  .on("success", () => console.log("Model installed"))
  .on("error", (code) => console.error("Download failed", code))
  .on("opened_dialog", () =>
    console.log("Complete the download in the system dialog"),
  );

// Optional: stop listening early (e.g. effect cleanup component unmount).
// `success` / `error` dispose the handle automatically.
download.dispose();
```