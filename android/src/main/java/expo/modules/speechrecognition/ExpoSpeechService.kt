package expo.modules.speechrecognition

import android.annotation.SuppressLint
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ResolveInfo
import android.media.AudioFormat
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognitionService
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.lang.ref.WeakReference
import java.net.URL
import java.util.Locale
import java.util.UUID

data class SpeechRecognitionErrorEvent(
    val error: String,
    val message: String,
)

enum class RecognitionState {
    INACTIVE, // Represents the inactive state
    ACTIVE, // Represents the active state
    ERROR, // Inactive, but error occurred. Prevent dispatching any additional events until start() is called
    // Add more states as needed
}

class ExpoSpeechService
    private constructor(
        private val reactContext: Context,
        private val sendEvent: (name: String, body: Map<String, Any?>?) -> Unit,
    ) : RecognitionListener {
        private var speech: SpeechRecognizer? = null
        private var recognitionState = RecognitionState.INACTIVE
        private var soundStartEventCalled = false
        private val mainHandler = Handler(Looper.getMainLooper())
        private var audioRecorder: ExpoAudioRecorder? = null

        /**
         * Reference for a remote file, for file-based recognition
         */
        private var downloadedFileHandle: File? = null

        companion object {
            @Volatile
            private var instance: WeakReference<ExpoSpeechService>? = null

            fun getInstance(
                reactContext: Context,
                sendEventFunction: (name: String, body: Map<String, Any?>?) -> Unit,
            ): ExpoSpeechService =
                instance?.get() ?: synchronized(this) {
                    instance?.get() ?: ExpoSpeechService(reactContext, sendEventFunction).also {
                        instance = WeakReference(it)
                    }
                }
        }

        @SuppressLint("QueryPermissionsNeeded")
        private fun findComponentNameByPackageName(packageName: String): ComponentName {
            val packageManager = reactContext.packageManager
            val services: List<ResolveInfo> = packageManager.queryIntentServices(Intent(RecognitionService.SERVICE_INTERFACE), 0)

            for (service in services) {
                if (service.serviceInfo.packageName == packageName) {
                    log("Found service for package $packageName: ${service.serviceInfo.name}")
                    return ComponentName(service.serviceInfo.packageName, service.serviceInfo.name)
                }
            }

            throw Exception("No service found for package $packageName")
        }

        private fun log(message: String) {
            Log.d("ExpoSpeechService", message)
        }

        private fun createSpeechRecognizer(options: SpeechRecognitionOptions): SpeechRecognizer? {
            val value =
                when {
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && options.requiresOnDeviceRecognition -> {
                        SpeechRecognizer.createOnDeviceSpeechRecognizer(reactContext)
                    }
                    // Custom service package, e.g. "com.google.android.googlequicksearchbox"
                    // Note: requires to be listed in AppManifest <queries> for this intent (android.speech.RecognitionService)
                    // Otherwise it will throw "Bind to system recognition service failed with error 10"
                    options.androidRecognitionServicePackage != null -> {
                        SpeechRecognizer.createSpeechRecognizer(
                            reactContext,
                            findComponentNameByPackageName(options.androidRecognitionServicePackage),
                        )
                    }
                    else -> {
                        SpeechRecognizer.createSpeechRecognizer(reactContext)
                    }
                }

            return value
        }

        /** Starts speech recognition */
        fun start(options: SpeechRecognitionOptions) {
            mainHandler.post {
                log("Start recognition.")

                // Destroy any previous SpeechRecognizer / audio recorder
                speech?.destroy()
                audioRecorder?.stop()
                audioRecorder = null
                recognitionState = RecognitionState.ACTIVE
                soundStartEventCalled = false

                try {
                    val intent = createSpeechIntent(options)
                    speech = createSpeechRecognizer(options)
                    // Start the audio recorder, if necessary
                    audioRecorder?.start()

                    // Start listening
                    speech?.setRecognitionListener(this)
                    speech?.startListening(intent)
                } catch (e: Exception) {
                    log("Failed to create Speech Recognizer")
                    sendEvent("error", mapOf("code" to "audio-capture", "message" to e.localizedMessage))
                    stop()
                }
            }
        }

        /**
         * Stops the audio recorder and sends the recorded audio file path to the app.
         */
        private fun stopRecording() {
            audioRecorder?.stop()
            if (audioRecorder?.outputFile != null) {
                sendEvent(
                    "recording",
                    mapOf(
                        "filePath" to audioRecorder?.outputFile?.absolutePath,
                    ),
                )
            }
            audioRecorder = null
        }

        fun stop() {
            teardownAndEnd()
        }

        /**
         * Stops speech recognition, recording and updates state
         */
        private fun teardownAndEnd(state: RecognitionState = RecognitionState.INACTIVE) {
            mainHandler.post {
                try {
                    speech?.stopListening()
                } catch (e: Exception) {
                    // do nothing
                }
                speech?.destroy()
                stopRecording()
                // sendEvent("audioend", null)
                sendEvent("end", null)
                try {
                    downloadedFileHandle?.delete()
                } catch (e: Exception) {
                    //
                }
                recognitionState = state
            }
        }

        private fun createSpeechIntent(options: SpeechRecognitionOptions): Intent {
            val intent = Intent(options.androidIntent ?: RecognizerIntent.ACTION_RECOGNIZE_SPEECH)

            // Optional boolean to indicate whether partial results should be returned by
            // the recognizer as the user speaks (default is false).
            // The server may ignore a request for partial results in some or all cases.
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, options.interimResults)

            // Allow users to override the language mode
            if (options.androidIntentOptions?.containsKey("EXTRA_LANGUAGE_MODEL") != true) {
                intent.putExtra(
                    RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                    RecognizerIntent.LANGUAGE_MODEL_FREE_FORM,
                )
            }

            // Feature: Stream microphone input to SpeechRecognition so the user can access the audio blob
            if (options.recordingOptions?.persist == true && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val filePath =
                    options.recordingOptions.outputFilePath ?: run {
                        val timestamp = System.currentTimeMillis().toString()
                        "${reactContext.cacheDir.absolutePath}/audio_$timestamp.wav"
                    }

                audioRecorder =
                    ExpoAudioRecorder(reactContext, filePath).apply {
                        intent.putExtra(
                            RecognizerIntent.EXTRA_AUDIO_SOURCE,
                            this.recordingParcel,
                        )
                        intent.putExtra(
                            RecognizerIntent.EXTRA_AUDIO_SOURCE_CHANNEL_COUNT,
                            1,
                        )
                        intent.putExtra(
                            RecognizerIntent.EXTRA_AUDIO_SOURCE_ENCODING,
                            this.audioFormat,
                        )
                        intent.putExtra(
                            RecognizerIntent.EXTRA_AUDIO_SOURCE_SAMPLING_RATE,
                            this.sampleRateInHz,
                        )
                        intent.putExtra(
                            RecognizerIntent.EXTRA_SEGMENTED_SESSION,
                            if (options.continuous) {
                                RecognizerIntent.EXTRA_AUDIO_SOURCE
                            } else {
                                RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS
                            },
                        )
                        if (!options.continuous) {
                            intent.putExtra(
                                RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS,
                                2000,
                            )
                            intent.putExtra(
                                RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS,
                                1000,
                            )
                            intent.putExtra(
                                RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS,
                                2000,
                            )
                        }
                    }
            }

            // Feature: Transcribe audio from a local or remote file
            if (options.audioSource?.uri != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val file = resolveSourceUri(options.audioSource.uri)
                intent.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE, file.absolutePath)
                intent.putExtra(
                    RecognizerIntent.EXTRA_AUDIO_SOURCE_ENCODING,
                    options.audioSource.audioEncoding?.androidAudioFormat ?: AudioFormat.ENCODING_MP3,
                )
                intent.putExtra(
                    RecognizerIntent.EXTRA_AUDIO_SOURCE_SAMPLING_RATE,
                    options.audioSource.sampleRate ?: 16000,
                )
            }

            val contextualStrings = options.contextualStrings
            if (!contextualStrings.isNullOrEmpty() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                // Optional list of strings, towards which the recognizer should bias the recognition results.
                // These are separate from the device context.
                val strings = ArrayList(contextualStrings)
                log("biasing strings: ${strings.joinToString(", ")}")
                intent.putExtra(
                    RecognizerIntent.EXTRA_BIASING_STRINGS,
                    // List<String> -> ArrayList<java.lang.String>
                    ArrayList(contextualStrings),
                )
            }

            if (options.addsPunctuation && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                intent.putExtra(RecognizerIntent.EXTRA_ENABLE_FORMATTING, RecognizerIntent.FORMATTING_OPTIMIZE_QUALITY)
            }

            // Offline recognition
            // to be used with ACTION_RECOGNIZE_SPEECH, ACTION_VOICE_SEARCH_HANDS_FREE, ACTION_WEB_SEARCH
            if (options.requiresOnDeviceRecognition) {
                intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
            }

            // Optional limit on the maximum number of results to return.
            // If omitted the recognizer will choose how many results to return. Must be an integer.
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, options.maxAlternatives)

            val language = options.lang.takeIf { it.isNotEmpty() } ?: Locale.getDefault().toString()
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language)

            log("androidIntentOptions: ${options.androidIntentOptions}")

            // Add any additional intent extras provided by the user
            options.androidIntentOptions?.forEach { (key, value) ->
                // Use reflection to set the extra
                // i.e. RecognizerIntent[key
                val field = RecognizerIntent::class.java.getDeclaredField(key)
                val fieldValue = field.get(null) as? String

                log("Resolved key $key -> $fieldValue with value: $value (${value.javaClass.name})")
                when (value) {
                    is Boolean -> intent.putExtra(fieldValue, value)
                    is Int -> intent.putExtra(fieldValue, value)
                    is String -> intent.putExtra(fieldValue, value)
                    is List<*> -> {
                        if (value.all { it is String }) {
                            intent.putExtra(fieldValue, value.filterIsInstance<String>().toTypedArray())
                        }
                    }
                    is Double -> intent.putExtra(fieldValue, value.toInt())
                    else -> throw IllegalArgumentException("Unsupported type for androidIntentOptions.$key: ${value.javaClass.name}")
                }
            }

            return intent
        }

        /**
         * Resolves the source URI to a local file path
         */
        private fun resolveSourceUri(sourceUri: String): File {
            // Local file assets
            if (!sourceUri.startsWith("https://")) {
                return File(sourceUri)
            }
            // Download the file
            val generatedFileName = UUID.randomUUID().toString()
            val file = File(reactContext.cacheDir, generatedFileName)
            val url = URL(sourceUri)
            val connection = url.openConnection()
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            connection.doInput = true
            connection.connect()
            val input = connection.getInputStream()
            val output = FileOutputStream(file)
            input.copyTo(output)
            output.close()
            input.close()
            downloadedFileHandle = file
            return file
        }

        override fun onReadyForSpeech(params: Bundle?) {
            // Avoid sending this event if there was an error
            // An error may preempt this event in the case of a permission error or a language not supported error
            if (recognitionState != RecognitionState.ERROR) {
                sendEvent("start", null)
            }
        }

        override fun onBeginningOfSpeech() {
            sendEvent("speechstart", null)
        }

        override fun onRmsChanged(rmsdB: Float) {
            // Call "soundstart" event if not already called
            if (!soundStartEventCalled) {
                sendEvent("soundstart", null)
                soundStartEventCalled = true
            }
            // sendEvent("volumechange", mapOf("volume" to rmsdB))
        }

        override fun onBufferReceived(buffer: ByteArray?) {
            // More sound has been received.
        }

        override fun onEndOfSpeech() {
            // recognitionState = RecognitionState.INACTIVE
            sendEvent("speechend", null)
            log("onEndOfSpeech()")
        }

        override fun onError(error: Int) {
            val errorInfo = getErrorInfo(error)
            // Web Speech API:
            // https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/nomatch_event
            if (error == SpeechRecognizer.ERROR_NO_MATCH) {
                sendEvent("nomatch", null)
            }

            sendEvent("error", mapOf("code" to errorInfo.error, "message" to errorInfo.message))
            teardownAndEnd(RecognitionState.ERROR)
            log("onError() - ${errorInfo.error}: ${errorInfo.message} - code: $error")
        }

        override fun onResults(results: Bundle?) {
            val resultsList = mutableListOf<String>()
            results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.let { matches ->
                resultsList.addAll(matches)
            }
            // Ensure we have at least one result
            if (resultsList.isEmpty()) {
                resultsList.add("")
            }
            sendEvent("result", mapOf("transcriptions" to resultsList, "isFinal" to true))
            log("onResults(), transcriptions: ${resultsList.joinToString(", ")}")

            teardownAndEnd()
        }

        override fun onPartialResults(partialResults: Bundle?) {
            val partialResultsList = mutableListOf<String>()
            partialResults
                ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.let { matches ->
                    partialResultsList.addAll(matches)
                }

            // Avoid sending result event if there was an empty result, or the first result is an empty string
            val nonEmptyStrings = partialResultsList.filter { it.isNotEmpty() }

            log("onPartialResults(), transcriptions: ${nonEmptyStrings.joinToString(", ")}")
            if (nonEmptyStrings.isNotEmpty()) {
                sendEvent("result", mapOf("transcriptions" to nonEmptyStrings, "isFinal" to false))
            }
        }

        /**
         * For API 33: Basically same as onResults but doesn't stop
         */
        override fun onSegmentResults(segmentResults: Bundle) {
            val resultsList = mutableListOf<String>()
            segmentResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.let { matches ->
                resultsList.addAll(matches)
            }
            // Ensure we have at least one result
            if (resultsList.isEmpty()) {
                resultsList.add("")
            }
            sendEvent("result", mapOf("transcriptions" to resultsList, "isFinal" to true))
            log("onSegmentResults(), transcriptions: ${resultsList.joinToString(", ")}")
        }

        override fun onEndOfSegmentedSession() {
            log("onEndOfSegmentedSession()")
            teardownAndEnd()
        }

        override fun onEvent(
            eventType: Int,
            params: Bundle?,
        ) {
            // Reserved for future events
        }

        private fun getErrorInfo(errorCode: Int): SpeechRecognitionErrorEvent {
            // Mapped to error
            // https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionErrorEvent/error
            val error: String =
                when (errorCode) {
                    // Audio recording error.
                    SpeechRecognizer.ERROR_AUDIO -> "audio-capture"
                    SpeechRecognizer.ERROR_CLIENT -> "client"
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "service-not-allowed"
                    SpeechRecognizer.ERROR_NETWORK -> "network"
                    SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "network"
                    SpeechRecognizer.ERROR_NO_MATCH -> "no-speech"
                    SpeechRecognizer.ERROR_SERVER -> "network"
                    // Extra codes
                    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "speech-timeout"
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "recognizer-busy"
                    SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE -> "language-not-supported"
                    else -> "unknown"
                }

            val message: String =
                when (errorCode) {
                    SpeechRecognizer.ERROR_AUDIO -> "Audio recording error."
                    SpeechRecognizer.ERROR_CLIENT -> "Other client side errors."
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Insufficient permissions"
                    SpeechRecognizer.ERROR_NETWORK -> "Other network related errors."
                    SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network operation timed out."
                    SpeechRecognizer.ERROR_NO_MATCH -> "No speech was detected."
                    SpeechRecognizer.ERROR_SERVER -> "Server sent error status."
                    // Extra codes/messages
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "RecognitionService busy."
                    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech input."
                    SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE -> "Requested language is supported, but not yet downloaded."
                    else -> "Unknown error"
                }

            return SpeechRecognitionErrorEvent(error, message)
        }
    }
