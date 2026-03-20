---
"expo-speech-recognition": patch
---

Avoid restarting the iOS audio engine during audio route changes while the app
is leaving the foreground, which could still crash some speech-recognition
sessions after the 3.1.1 input-node readiness fix.
