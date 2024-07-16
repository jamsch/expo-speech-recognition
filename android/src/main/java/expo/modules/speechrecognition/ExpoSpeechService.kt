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
import android.os.ParcelFileDescriptor
import android.speech.RecognitionListener
import android.speech.RecognitionPart
import android.speech.RecognitionService
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.lang.ref.WeakReference
import java.net.URI
import java.net.URL
import java.util.Locale
import java.util.UUID
import javax.net.ssl.HttpsURLConnection

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

/**
* Represents the state of the sound for tracking sound events (soundstart, soundend)
*/
enum class SoundState {
    INACTIVE,
    ACTIVE,
    SILENT,
}

class ExpoSpeechService
    private constructor(
        private val reactContext: Context,
        private val sendEvent: (name: String, body: Map<String, Any?>?) -> Unit,
    ) : RecognitionListener {
        private var speech: SpeechRecognizer? = null
        private var recognitionState = RecognitionState.INACTIVE
        private val mainHandler = Handler(Looper.getMainLooper())
        private var audioRecorder: ExpoAudioRecorder? = null
        private var soundState = SoundState.INACTIVE
        private var lastTimeSoundDetected = 0L

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
                soundState = SoundState.INACTIVE

                val instance = this

                GlobalScope.launch(Dispatchers.IO) {
                    try {
                        val intent = createSpeechIntent(options)
                        withContext(Dispatchers.Main) {
                            speech = createSpeechRecognizer(options)
                            // Start the audio recorder, if necessary
                            audioRecorder?.start()

                            // Start listening
                            speech?.setRecognitionListener(instance)
                            speech?.startListening(intent)

                            sendEvent("audiostart", null)
                        }
                    } catch (e: Exception) {
                        val errorMessage =
                            when {
                                e.localizedMessage != null -> e.localizedMessage
                                e.message != null -> e.message
                                else -> "Unknown error"
                            }

                        log("Failed to create Speech Recognizer with error: $errorMessage")
                        withContext(Dispatchers.Main) {
                            sendEvent("error", mapOf("code" to "audio-capture", "message" to errorMessage))
                            stop()
                        }
                    }
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
                soundState = SoundState.INACTIVE
                sendEvent("audioend", null)
                sendEvent("end", null)

                // If the source was a remote file, delete it
                try {
                    downloadedFileHandle?.delete()
                } catch (e: Exception) {
                    //
                }
                recognitionState = state
            }
        }

        private suspend fun createSpeechIntent(options: SpeechRecognitionOptions): Intent {
            val action = options.androidIntent ?: RecognizerIntent.ACTION_RECOGNIZE_SPEECH
            val intent = Intent(action)

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

            // Feature: Confidence levels on transcript words (i.e. `results[x].segments` on the "result" event)
            if (action == RecognizerIntent.ACTION_RECOGNIZE_SPEECH &&
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
            ) {
                intent.putExtra(RecognizerIntent.EXTRA_REQUEST_WORD_CONFIDENCE, true)
                intent.putExtra(RecognizerIntent.EXTRA_REQUEST_WORD_TIMING, true)
            }

            // Feature: Stream microphone input to SpeechRecognition so the user can access the audio blob
            if (options.recordingOptions?.persist == true &&
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                options.audioSource == null
            ) {
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
            if (options.audioSource?.uri != null) {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
                    throw Exception("Audio source is only supported on Android 13 and above")
                }

                log("Transcribing audio from local file: ${options.audioSource.uri}")
                val file = resolveSourceUri(options.audioSource.uri)

                // The file should exist, otherwise throw an error
                if (!file.exists()) {
                    throw Exception("File not found: ${file.absolutePath}")
                }
                if (!file.canRead()) {
                    throw Exception("File cannot be read: ${file.absolutePath}")
                }

                val parcelFileDescriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
                intent.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE, parcelFileDescriptor)

                intent.putExtra(
                    RecognizerIntent.EXTRA_AUDIO_SOURCE_ENCODING,
                    options.audioSource.audioEncoding ?: AudioFormat.ENCODING_PCM_16BIT,
                )
                intent.putExtra(
                    RecognizerIntent.EXTRA_AUDIO_SOURCE_SAMPLING_RATE,
                    options.audioSource.sampleRate ?: 16000,
                )
                intent.putExtra(
                    RecognizerIntent.EXTRA_AUDIO_SOURCE_CHANNEL_COUNT,
                    options.audioSource.audioChannels ?: 1,
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
        private suspend fun resolveSourceUri(sourceUri: String): File =
            when {
                // Local file path without URI scheme
                !sourceUri.startsWith("https://") && !sourceUri.startsWith("file://") -> File(sourceUri)

                // File URI
                sourceUri.startsWith("file://") -> File(URI(sourceUri))

                // HTTP URI - Download the file
                else -> {
                    log("Downloading file from $sourceUri")
                    downloadFile(sourceUri)
                }
            }

        private suspend fun downloadFile(sourceUri: String): File =
            withContext(Dispatchers.IO) {
                val generatedFileName = UUID.randomUUID().toString()
                val file = File(reactContext.cacheDir, generatedFileName)
                var input: InputStream? = null
                var output: FileOutputStream? = null
                try {
                    val connection = URL(sourceUri).openConnection() as HttpsURLConnection
                    connection.requestMethod = "GET"
                    connection.connect()

                    val responseCode = connection.responseCode
                    if (responseCode != HttpsURLConnection.HTTP_OK) {
                        throw IOException("Failed to download file: HTTP error code $responseCode")
                    }

                    input = connection.inputStream
                    output = FileOutputStream(file)
                    input.copyTo(output)

                    downloadedFileHandle = file
                    file
                } catch (e: Exception) {
                    log("Error downloading file from $sourceUri: ${e.message}")
                    throw e
                } finally {
                    try {
                        input?.close()
                    } catch (e: IOException) {
                        log("Error closing input stream: ${e.message}")
                    }
                    try {
                        output?.close()
                    } catch (e: IOException) {
                        log("Error closing output stream: ${e.message}")
                    }
                }
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
            val isSilent = rmsdB <= 0

            if (!isSilent) {
                lastTimeSoundDetected = System.currentTimeMillis()
            }

            // Call "soundstart" event if not already called
            if (!isSilent && soundState != SoundState.ACTIVE) {
                sendEvent("soundstart", null)
                soundState = SoundState.ACTIVE
                log("Changed sound state to ACTIVE")
                return
            }

            // If the sound is silent for more than 150ms, send "soundend" event
            if (isSilent && soundState == SoundState.ACTIVE && (System.currentTimeMillis() - lastTimeSoundDetected) > 150) {
                sendEvent("soundend", null)
                soundState = SoundState.SILENT
                log("Changed sound state to SILENT")
            }
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

        private fun getResults(results: Bundle?): List<Map<String, Any>> {
            val resultsList = mutableListOf<Map<String, Any>>()
            val confidences = results?.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES)

            results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.let { matches ->
                resultsList.addAll(
                    matches.mapIndexed { index, transcript ->
                        val confidence = confidences?.getOrNull(index) ?: 0f
                        mapOf(
                            "transcript" to transcript,
                            "confidence" to confidence,
                            "segments" to if (index == 0) getSegmentConfidences(results) else listOf(),
                        )
                    },
                )
            }

            return resultsList
        }

        private fun getSegmentConfidences(results: Bundle?): List<Map<String, Any>> {
            if (results == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                return listOf()
            }

            val recognitionParts =
                results.getParcelableArrayList(SpeechRecognizer.RECOGNITION_PARTS, RecognitionPart::class.java)
                    ?: return listOf()

            return recognitionParts
                .mapIndexed { index, it ->
                    // Just set the endTime as the next word minus a millisecond
                    val nextPart = recognitionParts.getOrNull(index + 1)
                    val endTime =
                        if (nextPart != null) {
                            nextPart.timestampMillis - 1
                        } else {
                            it.timestampMillis
                        }
                    mapOf(
                        "startTimeMillis" to it.timestampMillis,
                        // get index of next part
                        "endTimeMillis" to endTime,
                        "segment" to if (it.formattedText.isNullOrEmpty()) it.rawText else it.formattedText!!,
                        "confidence" to confidenceLevelToFloat(it.confidenceLevel),
                    )
                }
        }

        private fun confidenceLevelToFloat(confidenceLevel: Int): Float =
            when (confidenceLevel) {
                RecognitionPart.CONFIDENCE_LEVEL_HIGH -> 1.0f
                RecognitionPart.CONFIDENCE_LEVEL_MEDIUM_HIGH -> 0.8f
                RecognitionPart.CONFIDENCE_LEVEL_MEDIUM -> 0.6f
                RecognitionPart.CONFIDENCE_LEVEL_MEDIUM_LOW -> 0.4f
                RecognitionPart.CONFIDENCE_LEVEL_LOW -> 0.2f
                RecognitionPart.CONFIDENCE_LEVEL_UNKNOWN -> -1.0f
                else -> 0.0f
            }

        override fun onResults(results: Bundle?) {
            val resultsList = getResults(results)

            if (resultsList.isEmpty()) {
                // https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/nomatch_event
                // The nomatch event of the Web Speech API is fired
                // when the speech recognition service returns a final result with no significant recognition.
                sendEvent("nomatch", null)
            } else {
                sendEvent(
                    "result",
                    mapOf(
                        "results" to resultsList,
                        "isFinal" to true,
                    ),
                )
            }
            log("onResults(), results: $resultsList")

            teardownAndEnd()
        }

        override fun onPartialResults(partialResults: Bundle?) {
            val partialResultsList = getResults(partialResults)
            // Avoid sending result event if there was an empty result, or the first result is an empty string
            val nonEmptyStrings = partialResultsList.filter { it["transcript"]?.toString()?.isNotEmpty() ?: false }

            log("onPartialResults(), results: $nonEmptyStrings")
            if (nonEmptyStrings.isNotEmpty()) {
                sendEvent("result", mapOf("results" to nonEmptyStrings, "isFinal" to false))
            }
        }

        /**
         * For API 33: Basically same as onResults but doesn't stop
         */
        override fun onSegmentResults(segmentResults: Bundle) {
            val resultsList = getResults(segmentResults)
            if (resultsList.isEmpty()) {
                sendEvent("nomatch", null)
            } else {
                sendEvent(
                    "result",
                    mapOf(
                        "results" to resultsList,
                        "isFinal" to true,
                    ),
                )
            }
            log("onSegmentResults(), transcriptions: $resultsList")
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
