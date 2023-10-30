package expo.modules.speechrecognition

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import java.util.Locale

data class SpeechRecognitionErrorEvent(val error: String, val message: String)

enum class RecognitionState {
    INACTIVE, // Represents the inactive state
    ACTIVE, // Represents the active state
    // Add more states as needed
}

class ExpoSpeechService
private constructor(
        private val reactContext: Context,
        private val sendEvent: (name: String, body: Map<String, Any?>?) -> Unit
) : RecognitionListener {
    private var speech: SpeechRecognizer? = null
    private var recognitionState = RecognitionState.INACTIVE
    private var soundStartEventCalled = false

    companion object {
        @SuppressLint("StaticFieldLeak") private var instance: ExpoSpeechService? = null

        fun getInstance(
                reactContext: Context,
                sendEventFunction: (name: String, body: Map<String, Any?>?) -> Unit
        ): ExpoSpeechService {
            if (instance == null) {
                instance = ExpoSpeechService(reactContext, sendEventFunction)
            }
            return instance!!
        }
    }

    /** Starts speech recognition */
    fun start(options: SpeechRecognitionOptions) {
        // Destroy any previous SpeechRecognizer
        speech?.destroy()
        recognitionState = RecognitionState.ACTIVE
        soundStartEventCalled = false

        val intent = createSpeechIntent(options)

        speech = SpeechRecognizer.createSpeechRecognizer(reactContext)
        speech?.setRecognitionListener(this)
        speech?.startListening(intent)
    }

    fun getState(): RecognitionState {
        return recognitionState
    }

    private fun createSpeechIntent(options: SpeechRecognitionOptions): Intent {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)

        // Optional boolean to indicate whether partial results should be returned by
        // the recognizer as the user speaks (default is false).
        // The server may ignore a request for partial results in some or all cases.
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, options.interimResults ?: false)

        // Use a language model based on free-form speech recognition.
        // This is a value to use for EXTRA_LANGUAGE_MODEL.
        intent.putExtra(
                RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM, // LANGUAGE_MODEL_WEB_SEARCH
        )

        // Optional limit on the maximum number of results to return.
        // If omitted the recognizer will choose how many results to return. Must be an integer.
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, options.maxAlternatives ?: 1)

        val language = options.lang.takeIf { !it.isNullOrEmpty() } ?: Locale.getDefault().toString()
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language)

        return intent
    }

    override fun onReadyForSpeech(params: Bundle?) {
        // Call custom event
        sendEvent("_speechready", null)
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
        recognitionState = RecognitionState.INACTIVE
        sendEvent("speechend", null)
        // sendEvent("end", null)
        Log.d("ESR", "onEndOfSpeech()")
    }

    override fun onError(error: Int) {
        recognitionState = RecognitionState.INACTIVE
        val errorInfo = getErrorInfo(error)
        // Web Speech API:
        // https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/nomatch_event
        if (error == SpeechRecognizer.ERROR_NO_MATCH) {
            sendEvent("nomatch", null)
        }

        sendEvent("error", mapOf("code" to errorInfo.error, "message" to errorInfo.message))
        Log.d("ESR", "onError() - ${errorInfo.error}: ${errorInfo.message}")
    }

    override fun onResults(results: Bundle?) {
        recognitionState = RecognitionState.INACTIVE
        val resultsList = mutableListOf<String>()
        results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.let { matches ->
            resultsList.addAll(matches)
        }
        sendEvent("_results", mapOf("results" to resultsList))
        Log.d("ESR", "onResults()")
    }

    override fun onPartialResults(partialResults: Bundle?) {
        val partialResultsList = mutableListOf<String>()
        partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.let { matches ->
            partialResultsList.addAll(matches)
        }
        sendEvent("_partialresults", mapOf("results" to partialResultsList))
        Log.d("ESR", "onPartialResults()")
    }

    override fun onEvent(eventType: Int, params: Bundle?) {
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
                    else -> "Unknown error"
                }

        return SpeechRecognitionErrorEvent(error, message)
    }
}
