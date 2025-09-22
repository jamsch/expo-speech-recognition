/**
 * [iOS] Audio category used for defining the audio behavior
 *
 * Docs: [AVAudioSession.Category](https://developer.apple.com/documentation/avfaudio/avaudiosession/category)
 */
export const AVAudioSessionCategory = {
  /**
   * The category for an app in which sound playback is nonprimary — that is, your app also works with the sound turned off.
   *
   * This category is also appropriate for “play-along” apps, such as a virtual piano that a user plays while the Music app is playing.
   * When you use this category, audio from other apps mixes with your audio.
   * Screen locking and the Silent switch (on iPhone, the Ring/Silent switch) silence your audio.
   *
   * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/category/1616560-ambient
   */
  ambient: "ambient",
  /**
   * The default audio session category.
   *
   * Your audio is silenced by screen locking and by the Silent switch (called the Ring/Silent switch on iPhone).
   *
   * By default, using this category implies that your app’s audio is nonmixable—activating your session will interrupt any other audio sessions which are also nonmixable. To allow mixing, use the ambient category instead.
   *
   * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/category/1616488-soloambient
   */
  soloAmbient: "soloAmbient",
  /**
   * The category for playing recorded music or other sounds that are central to the successful use of your app.
   *
   * When using this category, your app audio continues with the Silent switch set to silent or when the screen locks. (The switch is called the Ring/Silent switch on iPhone.) To continue playing audio when your app transitions to the background (for example, when the screen locks), add the audio value to the UIBackgroundModes key in your information property list file.
   *
   * By default, using this category implies that your app’s audio is nonmixable—activating your session will interrupt any other audio sessions which are also nonmixable. To allow mixing for this category, use the mixWithOthers option.
   *
   * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/category/1616509-playback
   */
  playback: "playback",
  /**
   * The category for recording audio while also silencing playback audio.
   *
   * This category has the effect of silencing virtually all output on the system, for as long as the session is active. Unless you need to prevent any unexpected sounds from being played, use playAndRecord instead.
   *
   * To continue recording audio when your app transitions to the background (for example, when the screen locks), add the audio value to the UIBackgroundModes key in your information property list file.
   *
   * The user must grant permission for audio recording.
   *
   * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/category/1616451-record
   */
  record: "record",
  /**
   * The category for recording (input) and playback (output) of audio, such as for a Voice over Internet Protocol (VoIP) app.
   *
   * Your audio continues with the Silent switch set to silent and with the screen locked. (The switch is called the Ring/Silent switch on iPhone.) To continue playing audio when your app transitions to the background (for example, when the screen locks), add the audio value to the UIBackgroundModes key in your information property list file.
   *
   * This category is appropriate for simultaneous recording and playback, and also for apps that record and play back, but not simultaneously.
   *
   * By default, using this category implies that your app’s audio is nonmixable—activating your session will interrupt any other audio sessions which are also nonmixable. To allow mixing for this category, use the mixWithOthers option.
   *
   * The user must grant permission for audio recording.
   *
   * This category supports the mirrored version of AirPlay. However, AirPlay mirroring will be disabled if the AVAudioSessionModeVoiceChat mode is used with this category.
   *
   * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/category/1616568-playandrecord
   */
  playAndRecord: "playAndRecord",
  /**
   * The category for routing distinct streams of audio data to different output devices at the same time.
   *
   * This category can be used for input, output, or both. For example, use this category to route audio to
   * both a USB device and a set of headphones. Use of this category requires a more detailed knowledge of,
   * and interaction with, the capabilities of the available audio routes.
   *
   * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/category/1616484-multiroute
   */
  multiRoute: "multiRoute",
} as const;

/**
 * Constants that specify optional audio behaviors.
 *
 * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/categoryoptions
 */
export const AVAudioSessionCategoryOptions = {
  /**
   * An option that indicates whether audio from this session mixes with audio from active sessions in other audio apps.
   *
   * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/categoryoptions/1616611-mixwithothers
   */
  mixWithOthers: "mixWithOthers",
  /**
   * An option that reduces the volume of other audio sessions while audio from this session plays.
   *
   * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/categoryoptions/1616618-duckothers
   */
  duckOthers: "duckOthers",
  /**
   * An option that determines whether to pause spoken audio content from other sessions when your app plays its audio.
   *
   * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/categoryoptions/1616534-interruptspokenaudioandmixwithot
   */
  interruptSpokenAudioAndMixWithOthers: "interruptSpokenAudioAndMixWithOthers",
  /**
   * An option that determines whether Bluetooth hands-free devices appear as available input routes.
   *
   * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/categoryoptions/1616518-allowbluetooth
   */
  allowBluetooth: "allowBluetooth",
  /**
   * An option that determines whether you can stream audio from this session to Bluetooth devices that support the Advanced Audio Distribution Profile (A2DP).
   *
   * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/categoryoptions/1771735-allowbluetootha2dp
   */
  allowBluetoothA2DP: "allowBluetoothA2DP",
  /**
   * An option that determines whether you can stream audio from this session to AirPlay devices.
   *
   * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/categoryoptions/1771736-allowairplay
   */
  allowAirPlay: "allowAirPlay",
  /**
   * An option that determines whether audio from the session defaults to the built-in speaker instead of the receiver.
   *
   * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/categoryoptions/3727255-overridemutedmicrophoneinterrupt
   */
  defaultToSpeaker: "defaultToSpeaker",
  /**
   * An option that indicates whether the system interrupts the audio session when it mutes the built-in microphone.
   *
   * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/categoryoptions/3727255-overridemutedmicrophoneinterrupt
   */
  overrideMutedMicrophoneInterruption: "overrideMutedMicrophoneInterruption",
} as const;

/**
 * The audio session mode, together with the audio session category, indicates to the system how you intend to use audio in your app. You can use a mode to configure the audio system for specific use cases such as video recording, voice or video chat, or audio analysis.
 *
 * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/1616508-mode
 */
export const AVAudioSessionMode = {
  /**
   * The default audio session mode. You can use this mode with every audio session category.
   *
   * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/mode/1616579-default
   */
  default: "default",
  /**
   * A mode that the GameKit framework sets on behalf of an application that uses GameKit’s voice chat service. This mode is valid only with the playAndRecord audio session category.
   *
   * Don’t set this mode directly. If you need similar behavior and aren’t using a GKVoiceChat object, use voiceChat or videoChat instead.
   *
   * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/mode/1616511-gamechat
   */
  gameChat: "gameChat",
  /**
   * A mode that indicates that your app is performing measurement of audio input or output.
   *
   * Use this mode for apps that need to minimize the amount of system-supplied signal processing to input and output signals. If recording on devices with more than one built-in microphone, the session uses the primary microphone.
   *
   * Important: This mode disables some dynamics processing on input and output signals, resulting in a lower-output playback level.
   *
   * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/mode/1616608-measurement
   */
  measurement: "measurement",
  /**
   * A mode that indicates that your app is playing back movie content.
   *
   * When you set this mode, the audio session uses signal processing to enhance movie playback for certain audio routes such as built-in speaker or headphones. You may only use this mode with the `playback` audio session category.
   *
   * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/mode/1616623-movieplayback
   */
  moviePlayback: "moviePlayback",
  /**
   * A mode used for continuous spoken audio to pause the audio when another app plays a short audio prompt.
   *
   * This mode is appropriate for apps that play continuous spoken audio, such as podcasts or audio books. Setting this mode indicates that your app should pause, rather than duck, its audio if another app plays a spoken audio prompt. After the interrupting app’s audio ends, you can resume your app’s audio playback.
   *
   * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/mode/1616510-spokenaudio
   */
  spokenAudio: "spokenAudio",
  /**
   * A mode that indicates that your app is engaging in online video conferencing.
   *
   * Use this mode for video chat apps that use the `playAndRecord` or `record` categories. When you set this mode, the audio session optimizes the device’s tonal equalization for voice. It also reduces the set of allowable audio routes to only those appropriate for video chat.
   *
   * Using this mode has the side effect of enabling the `allowBluetooth` category option.
   *
   * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/mode/1616590-videochat
   */
  videoChat: "videoChat",
  /**
   * A mode that indicates that your app is recording a movie.
   *
   * This mode is valid only with the `record` and `playAndRecord` audio session categories. On devices with more than one built-in microphone, the audio session uses the microphone closest to the video camera.
   *
   * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/mode/1616535-videorecording
   */
  videoRecording: "videoRecording",
  /**
   * A mode that indicates that your app is performing two-way voice communication, such as using Voice over Internet Protocol (VoIP).
   *
   * Use this mode for Voice over IP (VoIP) apps that use the `playAndRecord` category. When you set this mode, the session optimizes the device’s tonal equalization for voice and reduces the set of allowable audio routes to only those appropriate for voice chat.
   *
   * Using this mode has the side effect of enabling the `allowBluetooth` category option.
   *
   * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/mode/1616455-voicechat
   */
  voiceChat: "voiceChat",
  /**
   * A mode that indicates that your app plays audio using text-to-speech.
   *
   * Setting this mode allows for different routing behaviors when your app connects to certain audio devices, such as CarPlay. An example of an app that uses this mode is a turn-by-turn navigation app that plays short prompts to the user.
   *
   * Typically, apps of the same type also configure their sessions to use the duckOthers and interruptSpokenAudioAndMixWithOthers options.
   *
   * Docs: https://developer.apple.com/documentation/avfaudio/avaudiosession/mode/2962803-voiceprompt
   */
  voicePrompt: "voicePrompt",
} as const;

/**
 * Options for the `EXTRA_LANGUAGE_MODEL` extra.
 *
 * Docs: https://developer.android.com/reference/android/speech/RecognizerIntent#EXTRA_LANGUAGE_MODEL
 */
export const RecognizerIntentExtraLanguageModel = {
  /**
   * https://developer.android.com/reference/android/speech/RecognizerIntent#LANGUAGE_MODEL_FREE_FORM
   *
   * Use a language model based on free-form speech recognition. This is a value to use for EXTRA_LANGUAGE_MODEL.
   */
  LANGUAGE_MODEL_FREE_FORM: "free_form",
  /**
   * https://developer.android.com/reference/android/speech/RecognizerIntent#LANGUAGE_MODEL_WEB_SEARCH
   *
   * Use a language model based on web search terms. This is a value to use for EXTRA_LANGUAGE_MODEL.
   */
  LANGUAGE_MODEL_WEB_SEARCH: "web_search",
} as const;

/**
 * Options for the `EXTRA_ENABLE_LANGUAGE_SWITCH` extra.
 *
 * Docs: https://developer.android.com/reference/android/speech/RecognizerIntent#EXTRA_LANGUAGE_SWITCH_MODEL
 */
export const RecognizerIntentEnableLanguageSwitch = {
  /**
   * A value to use for `EXTRA_ENABLE_LANGUAGE_SWITCH`.
   *
   * Enables language switch only when a new language is detected as at least [SpeechRecognizer#LANGUAGE_DETECTION_CONFIDENCE_LEVEL_CONFIDENT](https://developer.android.com/reference/android/speech/SpeechRecognizer#LANGUAGE_DETECTION_CONFIDENCE_LEVEL_CONFIDENT), which means the service is balancing between detecting a new language confidently and switching early.
   */
  LANGUAGE_SWITCH_BALANCED: "balanced",
  /**
   * A value to use for `EXTRA_ENABLE_LANGUAGE_SWITCH`.
   *
   * Enables language switch only when a new language is detected as [SpeechRecognizer#LANGUAGE_DETECTION_CONFIDENCE_LEVEL_HIGHLY_CONFIDENT](https://developer.android.com/reference/android/speech/SpeechRecognizer#LANGUAGE_DETECTION_CONFIDENCE_LEVEL_HIGHLY_CONFIDENT), which means the service may wait for longer before switching.
   */
  LANGUAGE_SWITCH_HIGH_PRECISION: "high_precision",
  /**
   * https://developer.android.com/reference/android/speech/RecognizerIntent#LANGUAGE_SWITCH_QUICK_RESPONSE
   *
   * A value to use for `EXTRA_ENABLE_LANGUAGE_SWITCH`.
   *
   * Enables language switch only when a new language is detected as at least [SpeechRecognizer#LANGUAGE_DETECTION_CONFIDENCE_LEVEL_NOT_CONFIDENT](https://developer.android.com/reference/android/speech/SpeechRecognizer#LANGUAGE_DETECTION_CONFIDENCE_LEVEL_NOT_CONFIDENT), which means the service should switch at the earliest moment possible.
   */
  LANGUAGE_SWITCH_QUICK_RESPONSE: "quick_response",
} as const;

/**
 * Android only
 *
 * See: [AudioFormat](https://developer.android.com/reference/android/media/AudioFormat)
 */
export const AudioEncodingAndroid = {
  /**
   * Audio data format: MP3 compressed
   */
  ENCODING_MP3: 9,
  /**
   * Audio data format: MPEG-H baseline profile, level 3
   */
  ENCODING_MPEGH_BL_L3: 23,
  /**
   * Audio data format: MPEG-H baseline profile, level 4
   */
  ENCODING_MPEGH_BL_L4: 24,
  /**
   * Audio data format: MPEG-H low complexity profile, level 3
   */
  ENCODING_MPEGH_LC_L3: 25,
  /**
   * Audio data format: MPEG-H low complexity profile, level 4
   */
  ENCODING_MPEGH_LC_L4: 26,
  /**
   * Audio data format: OPUS compressed.
   */
  ENCODING_OPUS: 20,
  /**
   * Audio data format: PCM 16 bit per sample. Guaranteed to be supported by devices.
   */
  ENCODING_PCM_16BIT: 2,
  /**
   * Audio data format: PCM 24 bit per sample packed as 3 bytes. The bytes are in little-endian order, so the least significant byte comes first in the byte array. Not guaranteed to be supported by devices, may be emulated if not supported.
   */
  ENCODING_PCM_24BIT_PACKED: 21,
  /**
   * Audio data format: PCM 32 bit per sample. Not guaranteed to be supported by devices, may be emulated if not supported.
   */
  ENCODING_PCM_32BIT: 22,
  /**
   * Audio data format: PCM 8 bit per sample. Not guaranteed to be supported by devices.
   */
  ENCODING_PCM_8BIT: 3,
  /**
   * Audio data format: single-precision floating-point per sample
   */
  ENCODING_PCM_FLOAT: 4,
} as const;

/**
 * [iOS Only] The type of task for which you are using speech recognition.
 *
 * Docs: https://developer.apple.com/documentation/speech/sfspeechrecognitiontaskhint
 */
export const TaskHintIOS = {
  /**
   * The task hint is unspecified.
   *
   * Use this hint type when the intended use for captured speech does not match the other task types.
   */
  unspecified: "unspecified",
  /**
   * A task that uses captured speech for text entry.
   *
   * Use this hint type when you are using speech recognition for a task that's similar to the keyboard's built-in dictation function.
   */
  dictation: "dictation",
  /**
   * A task that uses captured speech to specify seach terms.
   *
   * Use this hint type when you are using speech recognition to identify search terms.
   */
  search: "search",
  /**
   * A task that uses captured speech for short, confirmation-style requests.
   *
   * Use this hint type when you are using speech recognition to handle confirmation commands, such as "yes," "no," or "maybe."
   */
  confirmation: "confirmation",
} as const;

/**
 * An enum of the error codes for the Android SpeechRecognizer class.
 *
 * Docs: https://developer.android.com/reference/android/speech/SpeechRecognizer
 */
export const SpeechRecognizerErrorAndroid = {
  /** Audio recording error. */
  ERROR_AUDIO: 3,
  /** (API 33+) The service does not allow to check for support. */
  ERROR_CANNOT_CHECK_SUPPORT: 14,
  /** (API 33+) The service does not support listening to model downloads events. */
  ERROR_CANNOT_LISTEN_TO_DOWNLOAD_EVENTS: 15,
  /** Other client side errors. */
  ERROR_CLIENT: 5,
  /** Insufficient permissions */
  ERROR_INSUFFICIENT_PERMISSIONS: 9,
  /** Requested language is not available to be used with the current recognizer. */
  ERROR_LANGUAGE_NOT_SUPPORTED: 12,
  /** (API 31+) Requested language is supported, but not available currently (e.g. not downloaded yet). */
  ERROR_LANGUAGE_UNAVAILABLE: 13,
  /** Other network related errors. */
  ERROR_NETWORK: 2,
  /** Network operation timed out. */
  ERROR_NETWORK_TIMEOUT: 1,
  /** No recognition result matched. */
  ERROR_NO_MATCH: 7,
  /** RecognitionService busy. */
  ERROR_RECOGNIZER_BUSY: 8,
  /** Server sends error status. */
  ERROR_SERVER: 4,
  /** Server has been disconnected, e.g. because the app has crashed. */
  ERROR_SERVER_DISCONNECTED: 11,
  /** No speech input */
  ERROR_SPEECH_TIMEOUT: 6,
  /** (API 31+) Too many requests from the same client. */
  ERROR_TOO_MANY_REQUESTS: 10,
} as const;
