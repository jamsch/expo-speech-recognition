package expo.modules.speechrecognition

import android.media.AudioFormat
import android.speech.RecognizerIntent
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType

data class SpeechRecognitionOptions(
    val interimResults: Boolean = false,
    val lang: String = "en-US",
    val continuous: Boolean = false,
    val maxAlternatives: Int = 5,
    val contextualStrings: List<String>? = null,
    val requiresOnDeviceRecognition: Boolean = false,
    val addsPunctuation: Boolean = false,
    val androidIntentOptions: Map<String, Any?>? = null,
    val androidRecognitionServicePackage: String? = null,
    val audioSource: AudioSourceOptions? = null,
    val recordingOptions: RecordingOptions? = null,
    val androidIntent: String = RecognizerIntent.ACTION_RECOGNIZE_SPEECH,
    val volumeChangeEventOptions: VolumeChangeEventOptions? = null,
    val iosVoiceProcessingEnabled: Boolean = false,
)

data class VolumeChangeEventOptions(
    val enabled: Boolean = false,
    val intervalMillis: Int? = null,
)

data class RecordingOptions(
    val persist: Boolean = false,
    val outputDirectory: String? = null,
    val outputFileName: String? = null,
    val outputSampleRate: Int? = null,
    val outputEncoding: String? = null,
)

data class AudioSourceOptions(
    val uri: String = "",
    val audioEncoding: Int = AudioFormat.ENCODING_PCM_16BIT,
    val sampleRate: Int = 16000,
    val audioChannels: Int = 1,
    val chunkDelayMillis: Long? = null,
)

data class GetSupportedLocaleOptions(
    val androidRecognitionServicePackage: String? = null,
)

data class TriggerOfflineModelDownloadOptions(
    val locale: String = "en-US",
)

object SpeechRecognitionOptionsParser {
    fun fromReadableMap(map: ReadableMap?): SpeechRecognitionOptions {
        if (map == null) {
            return SpeechRecognitionOptions()
        }

        // 这里把 RN 的 ReadableMap 一次性解析成强类型对象，避免识别服务层继续依赖桥接层类型。
        return SpeechRecognitionOptions(
            interimResults = map.getBooleanOrDefault("interimResults", false),
            lang = map.getString("lang") ?: "en-US",
            continuous = map.getBooleanOrDefault("continuous", false),
            maxAlternatives = map.getIntOrDefault("maxAlternatives", 5),
            contextualStrings = map.getStringList("contextualStrings"),
            requiresOnDeviceRecognition = map.getBooleanOrDefault("requiresOnDeviceRecognition", false),
            addsPunctuation = map.getBooleanOrDefault("addsPunctuation", false),
            androidIntentOptions = map.getMap("androidIntentOptions")?.toHashMapRecursive(),
            androidRecognitionServicePackage = map.getString("androidRecognitionServicePackage"),
            audioSource = map.getMap("audioSource")?.let { audioSource ->
                AudioSourceOptions(
                    uri = audioSource.getString("uri") ?: "",
                    audioEncoding = audioSource.getIntOrDefault("audioEncoding", AudioFormat.ENCODING_PCM_16BIT),
                    sampleRate = audioSource.getIntOrDefault("sampleRate", 16000),
                    audioChannels = audioSource.getIntOrDefault("audioChannels", 1),
                    chunkDelayMillis = audioSource.getLongOrNull("chunkDelayMillis"),
                )
            },
            recordingOptions = map.getMap("recordingOptions")?.let { recording ->
                RecordingOptions(
                    persist = recording.getBooleanOrDefault("persist", false),
                    outputDirectory = recording.getString("outputDirectory"),
                    outputFileName = recording.getString("outputFileName"),
                    outputSampleRate = recording.getIntOrNull("outputSampleRate"),
                    outputEncoding = recording.getString("outputEncoding"),
                )
            },
            androidIntent = map.getString("androidIntent") ?: RecognizerIntent.ACTION_RECOGNIZE_SPEECH,
            volumeChangeEventOptions = map.getMap("volumeChangeEventOptions")?.let { volume ->
                VolumeChangeEventOptions(
                    enabled = volume.getBooleanOrDefault("enabled", false),
                    intervalMillis = volume.getIntOrNull("intervalMillis"),
                )
            },
            iosVoiceProcessingEnabled = map.getBooleanOrDefault("iosVoiceProcessingEnabled", false),
        )
    }

    fun getSupportedLocaleOptions(map: ReadableMap?): GetSupportedLocaleOptions =
        GetSupportedLocaleOptions(
            androidRecognitionServicePackage = map?.getString("androidRecognitionServicePackage"),
        )

    fun triggerOfflineModelDownloadOptions(map: ReadableMap?): TriggerOfflineModelDownloadOptions =
        TriggerOfflineModelDownloadOptions(
            locale = map?.getString("locale") ?: "en-US",
        )

    private fun ReadableMap.getBooleanOrDefault(key: String, defaultValue: Boolean): Boolean =
        if (hasKey(key) && !isNull(key)) getBoolean(key) else defaultValue

    private fun ReadableMap.getIntOrDefault(key: String, defaultValue: Int): Int =
        if (hasKey(key) && !isNull(key)) getInt(key) else defaultValue

    private fun ReadableMap.getIntOrNull(key: String): Int? =
        if (hasKey(key) && !isNull(key)) getInt(key) else null

    private fun ReadableMap.getLongOrNull(key: String): Long? =
        when {
            !hasKey(key) || isNull(key) -> null
            else -> getDouble(key).toLong()
        }

    private fun ReadableMap.getStringList(key: String): List<String>? =
        getArray(key)?.let { array ->
            buildList {
                for (index in 0 until array.size()) {
                    val value = array.getString(index)
                    if (value != null) {
                        add(value)
                    }
                }
            }
        }

    private fun ReadableMap.toHashMapRecursive(): Map<String, Any?> {
        val result = linkedMapOf<String, Any?>()
        val iterator = keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            result[key] =
                when (getType(key)) {
                    ReadableType.Null -> null
                    ReadableType.Boolean -> getBoolean(key)
                    ReadableType.Number -> getDouble(key)
                    ReadableType.String -> getString(key)
                    ReadableType.Map -> getMap(key)?.toHashMapRecursive()
                    ReadableType.Array -> getArray(key)?.toListRecursive()
                }
        }
        return result
    }

    private fun ReadableArray.toListRecursive(): List<Any?> =
        buildList {
            for (index in 0 until size()) {
                add(
                    when (getType(index)) {
                        ReadableType.Null -> null
                        ReadableType.Boolean -> getBoolean(index)
                        ReadableType.Number -> getDouble(index)
                        ReadableType.String -> getString(index)
                        ReadableType.Map -> getMap(index)?.toHashMapRecursive()
                        ReadableType.Array -> getArray(index)?.toListRecursive()
                    },
                )
            }
        }
}
