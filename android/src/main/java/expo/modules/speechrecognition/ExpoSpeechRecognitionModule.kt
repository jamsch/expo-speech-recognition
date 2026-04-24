package expo.modules.speechrecognition

import android.Manifest.permission.RECORD_AUDIO
import android.content.pm.PackageManager
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener

private const val TAG = "ExpoSpeechRecognition"
private const val REQUEST_RECORD_AUDIO = 9224

@ReactModule(name = ExpoSpeechRecognitionModule.NAME)
class ExpoSpeechRecognitionModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), PermissionListener, LifecycleEventListener {
    private var permissionPromise: Promise? = null

    private val expoSpeechService by lazy {
        ExpoSpeechService(reactContext) { name, body ->
            emitEvent(name, body)
        }
    }

    companion object {
        const val NAME = "ExpoSpeechRecognition"
    }

    init {
        reactContext.addLifecycleEventListener(this)
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun start(options: ReadableMap?) {
        val parsedOptions = SpeechRecognitionOptionsParser.fromReadableMap(options)

        if (!hasRecordPermission()) {
            emitEvent(
                "error",
                mapOf(
                    "error" to "not-allowed",
                    "message" to "Missing RECORD_AUDIO permission.",
                    "code" to -1,
                ),
            )
            emitEvent("end", null)
            return
        }

        expoSpeechService.start(parsedOptions)
    }

    @ReactMethod
    fun stop() {
        expoSpeechService.stop()
    }

    @ReactMethod
    fun abort() {
        emitEvent(
            "error",
            mapOf(
                "error" to "aborted",
                "message" to "Speech recognition aborted.",
                "code" to -1,
            ),
        )
        expoSpeechService.abort()
    }

    @ReactMethod
    fun getPermissionsAsync(promise: Promise) {
        promise.resolve(createPermissionResponse(hasRecordPermission(), canAskAgain()))
    }

    @ReactMethod
    fun requestPermissionsAsync(promise: Promise) {
        if (hasRecordPermission()) {
            promise.resolve(createPermissionResponse(granted = true, canAskAgain = false))
            return
        }

        val activity = currentActivity as? PermissionAwareActivity
        if (activity == null) {
            promise.reject(
                "no_activity",
                "Cannot request RECORD_AUDIO permission because the current activity does not support PermissionAwareActivity.",
            )
            return
        }

        if (permissionPromise != null) {
            promise.reject("permission_in_progress", "A permission request is already in progress.")
            return
        }

        permissionPromise = promise
        markRequested()
        activity.requestPermissions(arrayOf(RECORD_AUDIO), REQUEST_RECORD_AUDIO, this)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // RN 的 NativeEventEmitter 会调用这个方法，这里不需要额外逻辑，只保留桥接契约。
    }

    @ReactMethod
    fun removeListeners(count: Double) {
        // RN 的 NativeEventEmitter 会调用这个方法，这里不需要额外逻辑，只保留桥接契约。
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray,
    ): Boolean {
        if (requestCode != REQUEST_RECORD_AUDIO) {
            return false
        }

        val promise = permissionPromise
        permissionPromise = null

        if (promise == null) {
            return true
        }

        val granted =
            grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED

        promise.resolve(
            createPermissionResponse(
                granted = granted,
                canAskAgain = if (granted) false else canAskAgain(),
            ),
        )

        return true
    }

    override fun onHostResume() = Unit

    override fun onHostPause() = Unit

    override fun onHostDestroy() {
        expoSpeechService.destroy()
    }

    private fun hasRecordPermission(): Boolean =
        ContextCompat.checkSelfPermission(reactContext, RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    private fun canAskAgain(): Boolean {
        val activity = currentActivity ?: return false
        return activity.shouldShowRequestPermissionRationale(RECORD_AUDIO) || !hasRequestedBefore()
    }

    private fun hasRequestedBefore(): Boolean =
        reactContext
            .getSharedPreferences("expo_speech_recognition", 0)
            .getBoolean("record_audio_requested", false)

    private fun markRequested() {
        reactContext
            .getSharedPreferences("expo_speech_recognition", 0)
            .edit()
            .putBoolean("record_audio_requested", true)
            .apply()
    }

    private fun createPermissionResponse(granted: Boolean, canAskAgain: Boolean): WritableMap =
        Arguments.createMap().apply {
            putString("status", if (granted) "granted" else if (canAskAgain) "undetermined" else "denied")
            putBoolean("granted", granted)
            putBoolean("canAskAgain", canAskAgain)
            putString("expires", "never")
        }

    private fun emitEvent(name: String, body: Map<String, Any?>?) {
        if (!reactContext.hasActiveCatalystInstance()) {
            Log.w(TAG, "Skipping event $name because Catalyst instance is not active.")
            return
        }

        val payload = body?.toWritableMap()
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(name, payload)
    }

    private fun Map<String, Any?>.toWritableMap(): WritableMap =
        Arguments.createMap().also { map ->
            for ((key, value) in entries) {
                map.putDynamicValue(key, value)
            }
        }

    private fun List<Any?>.toWritableArray(): WritableArray =
        Arguments.createArray().also { array ->
            for (value in this) {
                array.pushDynamicValue(value)
            }
        }

    private fun WritableMap.putDynamicValue(key: String, value: Any?) {
        when (value) {
            null -> putNull(key)
            is Boolean -> putBoolean(key, value)
            is Int -> putInt(key, value)
            is Long -> putDouble(key, value.toDouble())
            is Float -> putDouble(key, value.toDouble())
            is Double -> putDouble(key, value)
            is String -> putString(key, value)
            is Map<*, *> -> {
                @Suppress("UNCHECKED_CAST")
                putMap(key, (value as Map<String, Any?>).toWritableMap())
            }
            is List<*> -> {
                @Suppress("UNCHECKED_CAST")
                putArray(key, (value as List<Any?>).toWritableArray())
            }
            else -> putString(key, value.toString())
        }
    }

    private fun WritableArray.pushDynamicValue(value: Any?) {
        when (value) {
            null -> pushNull()
            is Boolean -> pushBoolean(value)
            is Int -> pushInt(value)
            is Long -> pushDouble(value.toDouble())
            is Float -> pushDouble(value.toDouble())
            is Double -> pushDouble(value)
            is String -> pushString(value)
            is Map<*, *> -> {
                @Suppress("UNCHECKED_CAST")
                pushMap((value as Map<String, Any?>).toWritableMap())
            }
            is List<*> -> {
                @Suppress("UNCHECKED_CAST")
                pushArray((value as List<Any?>).toWritableArray())
            }
            else -> pushString(value.toString())
        }
    }
}
