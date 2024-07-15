package expo.modules.speechrecognition

import android.media.AudioFormat
import android.speech.RecognizerIntent
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.Enumerable

class SpeechRecognitionOptions : Record {
    @Field
    val interimResults: Boolean = false

    @Field
    val lang: String = "en-US"

    @Field
    val continuous: Boolean = false

    @Field
    val maxAlternatives: Int = 1

    @Field
    var contextualStrings: List<String>? = null

    @Field
    var requiresOnDeviceRecognition: Boolean = false

    @Field
    var addsPunctuation: Boolean = false

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
}

class RecordingOptions : Record {
    @Field
    val persist: Boolean = false

    @Field
    val outputFilePath: String? = null
}

enum class AudioEncodingOption(
    val value: String,
    val androidAudioFormat: Int,
) : Enumerable {
    ENCODING_MP3("ENCODING_MP3", AudioFormat.ENCODING_MP3),
    ENCODING_MPEGH_BL_L3("ENCODING_MPEGH_BL_L3", AudioFormat.ENCODING_MPEGH_BL_L3),
    ENCODING_MPEGH_BL_L4("ENCODING_MPEGH_BL_L4", AudioFormat.ENCODING_MPEGH_BL_L4),
    ENCODING_MPEGH_LC_L3("ENCODING_MPEGH_LC_L3", AudioFormat.ENCODING_MPEGH_LC_L3),
    ENCODING_MPEGH_LC_L4("ENCODING_MPEGH_LC_L4", AudioFormat.ENCODING_MPEGH_LC_L4),
    ENCODING_OPUS("ENCODING_OPUS", AudioFormat.ENCODING_OPUS),
    ENCODING_PCM_16BIT("ENCODING_PCM_16BIT", AudioFormat.ENCODING_PCM_16BIT),
    ENCODING_PCM_24BIT_PACKED("ENCODING_PCM_24BIT_PACKED", AudioFormat.ENCODING_PCM_24BIT_PACKED),
    ENCODING_PCM_32BIT("ENCODING_PCM_32BIT", AudioFormat.ENCODING_PCM_32BIT),
    ENCODING_PCM_8BIT("ENCODING_PCM_8BIT", AudioFormat.ENCODING_PCM_8BIT),
    ENCODING_PCM_FLOAT("ENCODING_PCM_FLOAT", AudioFormat.ENCODING_PCM_FLOAT),
}

class AudioSourceOptions : Record {
    @Field
    val uri: String = ""

    @Field
    val audioEncoding: AudioEncodingOption? = AudioEncodingOption.ENCODING_PCM_16BIT

    @Field
    val sampleRate: Int? = 16000

    @Field
    val audioChannels: Int? = 1
}

class GetSupportedLocaleOptions : Record {
    @Field
    val androidRecognitionServicePackage: String? = null

    @Field
    val onDevice: Boolean = false
}

class TriggerOfflineModelDownloadOptions : Record {
    @Field
    val locale: String = "en-US"
}
