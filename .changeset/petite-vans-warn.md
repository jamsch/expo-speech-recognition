---
"expo-speech-recognition": patch
---

Added `stopAsync()` and `abortAsync()` function helpers. These are the same as `stop()` and `abort()`, however they wait for the "end" event to be emitted before the function resolves.

Usage:

```js
import { stopAsync, abortAsync } from "expo-speech-recognition/helpers";

// Stopping will attempt to process the final result and end
await stopAsync();
console.log("Speech recognition has ended. We can safely call .start() again!");

// Otherwise, you can abort and just wait till it ends:
await abortAsync();
console.log("Speech recognition has ended. We can safely call .start() again!");
```
