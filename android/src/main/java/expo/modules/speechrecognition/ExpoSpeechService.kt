package expo.modules.speechrecognition

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import java.util.Locale

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

        companion object {
            @SuppressLint("StaticFieldLeak")
            private var instance: ExpoSpeechService? = null

            fun getInstance(
                reactContext: Context,
                sendEventFunction: (name: String, body: Map<String, Any?>?) -> Unit,
            ): ExpoSpeechService {
                if (instance == null) {
                    instance = ExpoSpeechService(reactContext, sendEventFunction)
                }
                return instance!!
            }
        }

        /** Starts speech recognition */
        fun start(options: SpeechRecognitionOptions) {
            mainHandler.post {
                Log.d("ExpoSpeechService", "Start recognition.")

                // Destroy any previous SpeechRecognizer
                speech?.destroy()
                recognitionState = RecognitionState.ACTIVE
                soundStartEventCalled = false

                val intent = createSpeechIntent(options)

                speech =
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && options.requiresOnDeviceRecognition) {
                        SpeechRecognizer.createOnDeviceSpeechRecognizer(reactContext)
                    } else {
                        SpeechRecognizer.createSpeechRecognizer(reactContext)
                    }
                speech?.setRecognitionListener(this)
                speech?.startListening(intent)
            }
        }

        fun stop() {
            mainHandler.post {
                speech?.destroy()
                recognitionState = RecognitionState.INACTIVE
            }
        }

        private fun createSpeechIntent(options: SpeechRecognitionOptions): Intent {
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)

            // Optional boolean to indicate whether partial results should be returned by
            // the recognizer as the user speaks (default is false).
            // The server may ignore a request for partial results in some or all cases.
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, options.interimResults)

            intent.putExtra(
                RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM,
            )

            val contextualStrings = options.contextualStrings
            if (!contextualStrings.isNullOrEmpty()) {
                intent.putExtra(
                    RecognizerIntent.EXTRA_BIASING_STRINGS,
                    contextualStrings.toTypedArray(),
                )
            }

            intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 10000)

            if (options.addsPunctuation) {
                intent.putExtra(RecognizerIntent.EXTRA_ENABLE_FORMATTING, RecognizerIntent.FORMATTING_OPTIMIZE_QUALITY)
            }

            // Offline recognition
            if (options.requiresOnDeviceRecognition && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
            }

            // Optional limit on the maximum number of results to return.
            // If omitted the recognizer will choose how many results to return. Must be an integer.
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, options.maxAlternatives)

            val language = options.lang.takeIf { !it.isNullOrEmpty() } ?: Locale.getDefault().toString()
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language)

            return intent
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
            // sendEvent("end", null)
            Log.d("ESR", "onEndOfSpeech()")
        }

        override fun onError(error: Int) {
            recognitionState = RecognitionState.ERROR
            val errorInfo = getErrorInfo(error)
            // Web Speech API:
            // https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/nomatch_event
            if (error == SpeechRecognizer.ERROR_NO_MATCH) {
                sendEvent("nomatch", null)
            }

            sendEvent("error", mapOf("code" to errorInfo.error, "message" to errorInfo.message))
            sendEvent("end", null)
            Log.d("ESR", "onError() - ${errorInfo.error}: ${errorInfo.message} - code: $error")
        }

        override fun onResults(results: Bundle?) {
            recognitionState = RecognitionState.INACTIVE
            val resultsList = mutableListOf<String>()
            results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.let { matches ->
                resultsList.addAll(matches)
            }
            sendEvent("result", mapOf("transcriptions" to resultsList, "isFinal" to true))
            Log.d("ESR", "onResults()")
            sendEvent("end", null)
        }

        override fun onPartialResults(partialResults: Bundle?) {
            val partialResultsList = mutableListOf<String>()
            partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.let { matches ->
                partialResultsList.addAll(matches)
            }
            sendEvent("result", mapOf("transcriptions" to partialResultsList, "isFinal" to false))
            Log.d("ESR", "onPartialResults()")
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
                    SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE -> "The selected language is not available."
                    else -> "Unknown error"
                }

            return SpeechRecognitionErrorEvent(error, message)
        }
    }
