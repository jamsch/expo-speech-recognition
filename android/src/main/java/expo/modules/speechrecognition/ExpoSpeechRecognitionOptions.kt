package expo.modules.speechrecognition

import android.media.AudioFormat
import android.speech.RecognizerIntent
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class SpeechRecognitionOptions : Record {
    @Field
    val interimResults: Boolean? = false

    @Field
    val lang: String = "en-US"

    @Field
    val continuous: Boolean? = false

    @Field
    val maxAlternatives: Int? = 5

    @Field
    var contextualStrings: List<String>? = null

    @Field
    var requiresOnDeviceRecognition: Boolean? = false

    @Field
    var addsPunctuation: Boolean? = false

    @Field
    var androidIntentOptions: Map<String, Any>? = null

    @Field
    val androidRecognitionServicePackage: String? = null

    /**
     * Provide an audio source (e.g. microphone or file) to use for speech recognition.
     */
    @Field
    val audioSource: AudioSourceOptions? = null

    @Field
    val recordingOptions: RecordingOptions? = null

    @Field
    val androidIntent: String? = RecognizerIntent.ACTION_RECOGNIZE_SPEECH

    @Field
    val iosTaskHint: String? = null

    @Field
    val iosCategory: Map<String, Any>? = null

    @Field
    val volumeChangeEventOptions: VolumeChangeEventOptions? = null

    @Field
    val iosVoiceProcessingEnabled: Boolean? = false
}

class VolumeChangeEventOptions : Record {
    @Field
    val enabled: Boolean? = false

    @Field
    val intervalMillis: Int? = null
}

class RecordingOptions : Record {
    @Field
    val persist: Boolean = false

    @Field
    val outputDirectory: String? = null

    @Field
    val outputFileName: String? = null

    @Field
    val outputSampleRate: Int? = null

    @Field
    val outputEncoding: String? = null
}

class AudioSourceOptions : Record {
    @Field
    val uri: String = ""

    @Field
    val audioEncoding: Int? = AudioFormat.ENCODING_PCM_16BIT

    @Field
    val sampleRate: Int? = 16000

    @Field
    val audioChannels: Int? = 1

    @Field
    val chunkDelayMillis: Long? = null
}

class GetSupportedLocaleOptions : Record {
    @Field
    val androidRecognitionServicePackage: String? = null
}

class TriggerOfflineModelDownloadOptions : Record {
    @Field
    val locale: String = "en-US"
}
