---
"expo-speech-recognition": patch
---

Fixed an Android unhandled `ArrayIndexOutOfBoundsException` crash when the audio recording fails.

This may happen when [`audioRecorder.read()`](<https://developer.android.com/reference/android/media/AudioRecord#read(short[],%20int,%20int,%20int)>) returns [`ERROR_INVALID_OPERATION`](https://developer.android.com/reference/android/media/AudioRecord#ERROR_INVALID_OPERATION), [`ERROR_BAD_VALUE`](https://developer.android.com/reference/android/media/AudioRecord#ERROR_BAD_VALUE), [`ERROR_DEAD_OBJECT`](https://developer.android.com/reference/android/media/AudioRecord#ERROR_DEAD_OBJECT), or the more generic [`ERROR`](https://developer.android.com/reference/android/media/AudioRecord#ERROR)
