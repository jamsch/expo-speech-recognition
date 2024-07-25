package expo.modules.speechrecognition

import android.Manifest.permission.RECORD_AUDIO
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.speech.ModelDownloadListener
import android.speech.RecognitionService
import android.speech.RecognitionSupport
import android.speech.RecognitionSupportCallback
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import androidx.annotation.RequiresApi
import expo.modules.interfaces.permissions.Permissions.askForPermissionsWithPermissionsManager
import expo.modules.interfaces.permissions.Permissions.getPermissionsWithPermissionsManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.Executors

class ExpoSpeechRecognitionModule : Module() {
    private val expoSpeechService by lazy {
        ExpoSpeechService(appContext.reactContext!!) { name, body ->
            val nonNullBody = body ?: emptyMap()
            try {
                sendEvent(name, nonNullBody)
            } catch (e: IllegalArgumentException) {
                // "Cannot create an event emitter for the module that isn't present in the module registry."
                // Likely can occur after destroying the module
                Log.e("ExpoSpeechRecognitionModule", "Failed to send event: $name", e)
            }
        }
    }

    // Each module class must implement the definition function. The definition consists of components
    // that describes the module's functionality and behavior.
    // See https://docs.expo.dev/modules/module-api for more details about available components.
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
            )

            Function("getSpeechRecognitionServices") {
                val packageManager = appContext.reactContext?.packageManager
                val serviceNames = mutableListOf<String>()

                if (packageManager == null) {
                    return@Function serviceNames // Early return with an empty list
                }

                val services =
                    packageManager.queryIntentServices(
                        Intent(RecognitionService.SERVICE_INTERFACE),
                        0,
                    )

                for (service in services) {
                    serviceNames.add(service.serviceInfo.packageName)
                }

                serviceNames
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
                    sendEvent("error", mapOf("code" to "not-allowed", "message" to "Missing RECORD_AUDIO permissions."))
                    sendEvent("end")
                    return@Function
                }
                expoSpeechService.start(options)
            }

            Function("stop") {
                expoSpeechService.stop()
            }

            Function("abort") {
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

                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    promise.reject(
                        "not_supported",
                        "Android version is too old to trigger offline model download.",
                        Throwable(),
                    )
                    return@AsyncFunction
                }
                isDownloadingModel = true
                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, options.locale)
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
                                promise.resolve(true)
                                isDownloadingModel = false
                                recognizer.destroy()
                            }

                            override fun onScheduled() {
                                //
                            }

                            override fun onError(error: Int) {
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

    private fun getSupportedLocales(
        options: GetSupportedLocaleOptions,
        appContext: Context,
        promise: Promise,
    ) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            promise.resolve(mutableListOf<String>())
            return
        }

        if (options.onDevice && !SpeechRecognizer.isOnDeviceRecognitionAvailable(appContext)) {
            promise.resolve(mutableListOf<String>())
            return
        }

        if (!options.onDevice && !SpeechRecognizer.isRecognitionAvailable(appContext)) {
            promise.resolve(mutableListOf<String>())
            return
        }

        var didResolve = false

        // Speech Recognizer can only be ran on main thread
        Handler(appContext.mainLooper).post {
            val recognizer =
                if (options.onDevice) {
                    SpeechRecognizer.createOnDeviceSpeechRecognizer(appContext)
                } else {
                    SpeechRecognizer.createSpeechRecognizer(appContext)
                }

            val recognizerIntent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            if (!options.onDevice && options.androidRecognitionServicePackage != null) {
                recognizerIntent.setPackage(options.androidRecognitionServicePackage)
            }
            Log.d("ESR", "Recognizer intent: $recognizerIntent")

            recognizer?.checkRecognitionSupport(
                recognizerIntent,
                Executors.newSingleThreadExecutor(),
                @RequiresApi(Build.VERSION_CODES.TIRAMISU)
                object : RecognitionSupportCallback {
                    override fun onSupportResult(recognitionSupport: RecognitionSupport) {
                        // Seems to get called twice
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
                        // No idea why, but onError always gets called
                        // regardless if onSupportResult is called
                        if (error != SpeechRecognizer.ERROR_CANNOT_CHECK_SUPPORT) {
                            promise.reject(
                                "error_$error",
                                "Failed to retrieve supported locales with error: $error",
                                Throwable(),
                            )
                        }
                        recognizer.destroy()
                    }
                },
            )
        }
    }
}
