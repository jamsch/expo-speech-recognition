---
"expo-speech-recognition": patch
---

Fix Android speech recognition in minified release builds by generating optimized Expo Modules record metadata. Pass string-list intent options using Android's `ArrayList<String>` extra format.
