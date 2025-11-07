package expo.modules.speechrecognition

import android.Manifest.permission.RECORD_AUDIO
import android.annotation.SuppressLint
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.provider.Settings
import android.speech.ModelDownloadListener
import android.speech.RecognitionService
import android.speech.RecognitionSupport
import android.speech.RecognitionSupportCallback
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import androidx.annotation.RequiresApi
import expo.modules.interfaces.permissions.PermissionsResponse
import expo.modules.interfaces.permissions.Permissions.askForPermissionsWithPermissionsManager
import expo.modules.interfaces.permissions.Permissions.getPermissionsWithPermissionsManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.Executors

private const val TAG = "ESRModule"

class ExpoSpeechRecognitionModule : Module() {
    private val expoSpeechService by lazy {
        ExpoSpeechService(appContext.reactContext!!) { name, body ->
            val nonNullBody = body ?: emptyMap()
            try {
                sendEvent(name, nonNullBody)
            } catch (e: IllegalArgumentException) {
                // "Cannot create an event emitter for the module that isn't present in the module registry."
                // Likely can occur after destroying the module
                Log.e(TAG, "Failed to send event: $name", e)
            }
        }
    }

    // Each module class must implement the definition function. The definition consists of components
    // that describes the module's functionality and behavior.
    // See https://docs.expo.dev/modules/module-api for more details about available components.
    @RequiresApi(Build.VERSION_CODES.FROYO)
    override fun definition() =
        ModuleDefinition {
            // Sets the name of the module that JavaScript code will use to refer to the module. Takes a
            // string as an argument.
            // Can be inferred from module's class name, but it's recommended to set it explicitly for
            // clarity.
            // The module will be accessible from `requireNativeModule('ExpoSpeechRecognition')` in
            // JavaScript.
            Name("ExpoSpeechRecognition")

            OnDestroy {
                expoSpeechService.destroy()
            }

            // Defines event names that the module can send to JavaScript.
            Events(
                // Fired when the user agent has started to capture audio.
                "audiostart",
                // Fired when the user agent has finished capturing audio.
                "audioend",
                // Fired when the speech recognition service has disconnected.
                "end",
                // Fired when a speech recognition error occurs.
                "error",
                // Fired when the speech recognition service returns a final result with no significant
                // recognition. This may involve some degree of recognition, which doesn't meet or
                // exceed the confidence threshold.
                "nomatch",
                // Fired when the speech recognition service returns a result — a word or phrase has been
                // positively recognized and this has been communicated back to the app.
                "result",
                // Fired when any sound — recognizable speech or not — has been detected.
                "soundstart",
                // Fired when any sound — recognizable speech or not — has stopped being detected.
                "soundend",
                // Fired when sound that is recognized by the speech recognition service as speech
                // has been detected.
                "speechstart",
                // Fired when speech recognized by the speech recognition service has stopped being
                // detected.
                "speechend",
                // Fired when the speech recognition service has begun listening to incoming audio with
                // intent to recognize grammars associated with the current SpeechRecognition
                "start",
                // Called when there's results (as a string array, not API compliant)
                "results",
                // Called when the language detection (and switching) results are available.
                "languagedetection",
                // Fired when the input volume changes
                "volumechange",
            )

            Function("getDefaultRecognitionService") {
                val defaultRecognitionService = getDefaultVoiceRecognitionService()?.packageName ?: ""
                return@Function mapOf(
                    "packageName" to defaultRecognitionService,
                )
            }

            Function("getAssistantService") {
                val assistantServicePackage = getDefaultAssistantService()?.packageName ?: ""
                return@Function mapOf(
                    "packageName" to assistantServicePackage,
                )
            }

            Function("getSpeechRecognitionServices") {
                val packageManager = appContext.reactContext?.packageManager
                val serviceNames = mutableListOf<String>()

                if (packageManager == null) {
                    return@Function serviceNames
                }

                val services =
                    packageManager.queryIntentServices(
                        Intent(RecognitionService.SERVICE_INTERFACE),
                        0,
                    )

                for (service in services) {
                    serviceNames.add(service.serviceInfo.packageName)
                }

                return@Function serviceNames
            }

            AsyncFunction("requestPermissionsAsync") { promise: Promise ->
                askForPermissionsWithPermissionsManager(
                    appContext.permissions,
                    promise,
                    RECORD_AUDIO,
                )
            }

            AsyncFunction("getPermissionsAsync") { promise: Promise ->
                getPermissionsWithPermissionsManager(
                    appContext.permissions,
                    promise,
                    RECORD_AUDIO,
                )
            }

            AsyncFunction("requestMicrophonePermissionsAsync") { promise: Promise ->
                askForPermissionsWithPermissionsManager(
                    appContext.permissions,
                    promise,
                    RECORD_AUDIO,
                )
            }

            AsyncFunction("getMicrophonePermissionsAsync") { promise: Promise ->
                getPermissionsWithPermissionsManager(
                    appContext.permissions,
                    promise,
                    RECORD_AUDIO,
                )
            }

            AsyncFunction("getSpeechRecognizerPermissionsAsync") { promise: Promise ->
                Log.w(TAG, "getSpeechRecognizerPermissionsAsync is not supported on Android. Returning a granted permission response.")
                promise.resolve(
                    Bundle().apply {
                        putString(PermissionsResponse.EXPIRES_KEY, "never")
                        putString(PermissionsResponse.STATUS_KEY, "granted")
                        putBoolean(PermissionsResponse.CAN_ASK_AGAIN_KEY, false)
                        putBoolean(PermissionsResponse.GRANTED_KEY, true)
                    }
                )
            }

            AsyncFunction("requestSpeechRecognizerPermissionsAsync") { promise: Promise ->
                Log.w(TAG, "requestSpeechRecognizerPermissionsAsync is not supported on Android. Returning a granted permission response.")
                promise.resolve(
                    Bundle().apply {
                        putString(PermissionsResponse.EXPIRES_KEY, "never")
                        putString(PermissionsResponse.STATUS_KEY, "granted")
                        putBoolean(PermissionsResponse.CAN_ASK_AGAIN_KEY, false)
                        putBoolean(PermissionsResponse.GRANTED_KEY, true)
                    }
                )
            }

            AsyncFunction("getStateAsync") { promise: Promise ->
                val state =
                    when (expoSpeechService.recognitionState) {
                        RecognitionState.INACTIVE -> "inactive"
                        RecognitionState.STARTING -> "starting"
                        RecognitionState.ACTIVE -> "recognizing"
                        RecognitionState.STOPPING -> "stopping"
                        else -> "inactive"
                    }

                promise.resolve(state)
            }

            /** Start recognition with args: lang, interimResults, maxAlternatives */
            Function("start") { options: SpeechRecognitionOptions ->
                if (hasNotGrantedRecordPermissions()) {
                    sendEvent("error", mapOf("error" to "not-allowed", "message" to "Missing RECORD_AUDIO permissions.", "code" to -1))
                    sendEvent("end")
                    return@Function
                }
                expoSpeechService.start(options)
            }

            Function("stop") {
                expoSpeechService.stop()
            }

            Function("abort") {
                sendEvent("error", mapOf("error" to "aborted", "message" to "Speech recognition aborted.", "code" to -1))
                expoSpeechService.abort()
            }

            AsyncFunction("getSupportedLocales") { options: GetSupportedLocaleOptions, promise: Promise ->
                getSupportedLocales(options, appContext.reactContext!!, promise)
            }

            Function("supportsOnDeviceRecognition") {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    SpeechRecognizer.isOnDeviceRecognitionAvailable(appContext.reactContext!!)
                } else {
                    false
                }
            }

            Function("isRecognitionAvailable") {
                SpeechRecognizer.isRecognitionAvailable(appContext.reactContext!!)
            }

            Function("supportsRecording") {
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            }

            // Not necessary for Android
            Function("setCategoryIOS") { _: Any ->
                // Do nothing
            }

            Function("getAudioSessionCategoryAndOptionsIOS") {
                // Just return dummy data, not necessary for Android
                return@Function mapOf(
                    "category" to "playAndRecord",
                    "categoryOptions" to listOf("defaultToSpeaker", "allowBluetooth"),
                    "mode" to "measurement",
                )
            }

            Function("setAudioSessionActiveIOS") { _: Any ->
                // Do nothing
            }

            var isDownloadingModel = false

            AsyncFunction("androidTriggerOfflineModelDownload") { options: TriggerOfflineModelDownloadOptions, promise: Promise ->
                if (isDownloadingModel) {
                    promise.reject(
                        "download_in_progress",
                        "An offline model download is already in progress.",
                        Throwable(),
                    )
                    return@AsyncFunction
                }

                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
                    promise.reject(
                        "not_supported",
                        "Android version is too old to trigger offline model download.",
                        Throwable(),
                    )
                    return@AsyncFunction
                }

                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, options.locale)

                // API 33 (Android 13) -- Trigger the model download but resolve immediately
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    Handler(appContext.reactContext!!.mainLooper).post {
                        val recognizer =
                            SpeechRecognizer.createOnDeviceSpeechRecognizer(appContext.reactContext!!)
                        recognizer.triggerModelDownload(intent)
                    }
                    promise.resolve(
                        mapOf(
                            "status" to "opened_dialog",
                            "message" to "Opened the model download dialog.",
                        ),
                    )
                    return@AsyncFunction
                }

                // API 34+ (Android 14+) -- Trigger the model download and listen to the progress
                isDownloadingModel = true
                Handler(appContext.reactContext!!.mainLooper).post {
                    val recognizer =
                        SpeechRecognizer.createOnDeviceSpeechRecognizer(appContext.reactContext!!)
                    recognizer.triggerModelDownload(
                        intent,
                        Executors.newSingleThreadExecutor(),
                        @SuppressLint("NewApi")
                        object : ModelDownloadListener {
                            override fun onProgress(p0: Int) {
                                // Todo: let user know the progress
                            }

                            override fun onSuccess() {
                                promise.resolve(
                                    mapOf(
                                        "status" to "download_success",
                                        "message" to "Offline model download completed successfully.",
                                    ),
                                )
                                isDownloadingModel = false
                                recognizer.destroy()
                            }

                            override fun onScheduled() {
                                promise.resolve(
                                    mapOf(
                                        "status" to "download_canceled",
                                        "message" to "The offline model download was canceled.",
                                    ),
                                )
                            }

                            override fun onError(error: Int) {
                                Log.e("ExpoSpeechService", "Error downloading model with code: $error")
                                isDownloadingModel = false
                                promise.reject(
                                    "error_$error",
                                    "Failed to download offline model download with error: $error",
                                    Throwable(),
                                )
                                recognizer.destroy()
                            }
                        },
                    )
                }
            }
        }

    private fun hasNotGrantedRecordPermissions(): Boolean = appContext.permissions?.hasGrantedPermissions(RECORD_AUDIO)?.not() ?: false

    @RequiresApi(Build.VERSION_CODES.CUPCAKE)
    private fun getDefaultAssistantService(): ComponentName? {
        val contentResolver = appContext.reactContext?.contentResolver ?: return null
        val defaultAssistant = Settings.Secure.getString(contentResolver, "assistant")
        if (defaultAssistant.isNullOrEmpty()) {
            return null
        }
        return ComponentName.unflattenFromString(defaultAssistant)
    }

    @RequiresApi(Build.VERSION_CODES.CUPCAKE)
    private fun getDefaultVoiceRecognitionService(): ComponentName? {
        val contentResolver = appContext.reactContext?.contentResolver ?: return null
        val defaultVoiceRecognitionService = Settings.Secure.getString(contentResolver, "voice_recognition_service")
        if (defaultVoiceRecognitionService.isNullOrEmpty()) {
            return null
        }
        return ComponentName.unflattenFromString(defaultVoiceRecognitionService)
    }

    private fun getSupportedLocales(
        options: GetSupportedLocaleOptions,
        appContext: Context,
        promise: Promise,
    ) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            promise.resolve(
                mapOf(
                    "locales" to mutableListOf<String>(),
                    "installedLocales" to mutableListOf<String>(),
                ),
            )
            return
        }

        if (options.androidRecognitionServicePackage == null && !SpeechRecognizer.isOnDeviceRecognitionAvailable(appContext)) {
            promise.resolve(
                mapOf(
                    "locales" to mutableListOf<String>(),
                    "installedLocales" to mutableListOf<String>(),
                ),
            )
            return
        }

        if (options.androidRecognitionServicePackage != null && !SpeechRecognizer.isRecognitionAvailable(appContext)) {
            promise.resolve(
                mapOf(
                    "locales" to mutableListOf<String>(),
                    "installedLocales" to mutableListOf<String>(),
                ),
            )
            return
        }

        var serviceComponent: ComponentName? = null
        try {
            if (options.androidRecognitionServicePackage != null) {
                serviceComponent =
                    ExpoSpeechService.findComponentNameByPackageName(
                        appContext,
                        options.androidRecognitionServicePackage,
                    )
            }
        } catch (e: Exception) {
            Log.e("ExpoSpeechService", "Couldn't resolve package: ${options.androidRecognitionServicePackage}")
            promise.reject(
                "package_not_found",
                "Failed to retrieve recognition service package",
                e,
            )
            return
        }

        var didResolve = false

        // Speech Recognizer can only be ran on main thread
        Handler(appContext.mainLooper).post {
            val recognizer =
                if (serviceComponent != null) {
                    SpeechRecognizer.createSpeechRecognizer(
                        appContext,
                        serviceComponent,
                    )
                } else {
                    SpeechRecognizer.createOnDeviceSpeechRecognizer(appContext)
                }

            val recognizerIntent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)

            recognizer?.checkRecognitionSupport(
                recognizerIntent,
                Executors.newSingleThreadExecutor(),
                @RequiresApi(Build.VERSION_CODES.TIRAMISU)
                object : RecognitionSupportCallback {
                    override fun onSupportResult(recognitionSupport: RecognitionSupport) {
                        Log.d("ExpoSpeechService", "onSupportResult() called with recognitionSupport: $recognitionSupport")
                        // Seems to get called twice when using `createSpeechRecognizer()`
                        if (didResolve) {
                            return
                        }
                        didResolve = true
                        // These languages are supported but need to be downloaded before use.
                        val installedLocales = recognitionSupport.installedOnDeviceLanguages

                        val locales =
                            recognitionSupport.supportedOnDeviceLanguages
                                .union(installedLocales)
                                .union(recognitionSupport.onlineLanguages)
                                .sorted()
                        promise.resolve(
                            mapOf(
                                "locales" to locales,
                                "installedLocales" to installedLocales,
                            ),
                        )
                        recognizer.destroy()
                    }

                    override fun onError(error: Int) {
                        Log.e("ExpoSpeechService", "getSupportedLocales.onError() called with error code: $error")
                        // This is a workaround for when both the onSupportResult and onError callbacks are called
                        // This occurs when providing some packages such as com.google.android.tts
                        // com.samsung.android.bixby.agent usually errors though
                        Handler(appContext.mainLooper).postDelayed({
                            if (didResolve) {
                                return@postDelayed
                            }
                            promise.reject(
                                "error_$error",
                                "Failed to retrieve supported locales with error: $error",
                                Throwable(),
                            )
                        }, 50)

                        recognizer.destroy()
                    }
                },
            )
        }
    }
}
