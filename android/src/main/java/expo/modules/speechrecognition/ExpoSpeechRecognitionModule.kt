package expo.modules.speechrecognition

import android.Manifest.permission.RECORD_AUDIO
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.speech.RecognitionService
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import expo.modules.interfaces.permissions.Permissions.askForPermissionsWithPermissionsManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class SpeechRecognitionOptions : Record {
    @Field val interimResults: Boolean = false

    @Field val lang: String = "en-US"

    @Field
    val continuous: Boolean = false

    @Field val maxAlternatives: Number = 1

    @Field
    var contextualStrings: List<String>? = null

    @Field
    var requiresOnDeviceRecognition: Boolean = false

    @Field
    var addsPunctuation: Boolean = false
}

class ExpoSpeechRecognitionModule : Module() {
  // Each module class must implement the definition function. The definition consists of components
  // that describes the module's functionality and behavior.
  // See https://docs.expo.dev/modules/module-api for more details about available components.
  override fun definition() = ModuleDefinition {
    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a
    // string as an argument.
    // Can be inferred from module's class name, but it's recommended to set it explicitly for
    // clarity.
    // The module will be accessible from `requireNativeModule('ExpoSpeechRecognition')` in
    // JavaScript.
    Name("ExpoSpeechRecognition")

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

        // Custom events

        // Called when the endpointer is ready for the user to start speaking.
        "_speechready",
    )

    Function("getSpeechRecognitionServices") {
      val packageManager = appContext.reactContext?.packageManager
      val serviceNames = mutableListOf<String>()

      if (packageManager == null) {
        return@Function serviceNames // Early return with an empty list
      }

      val services =
          packageManager.queryIntentServices(Intent(RecognitionService.SERVICE_INTERFACE), 0)

      for (service in services) {
        serviceNames.add(service.serviceInfo.packageName)
      }

      serviceNames
    }

    AsyncFunction("requestPermissionsAsync") { promise: Promise ->
      askForPermissionsWithPermissionsManager(appContext.permissions, promise, RECORD_AUDIO)
    }

    /** Start recognition with args: lang, interimResults, maxAlternatives */
    Function("start") { options: SpeechRecognitionOptions ->
      if (hasNotGrantedPermissions()) {
        throw PermissionsException("Missing RECORD_AUDIO permissions.")
      }
    val service =
        ExpoSpeechService.getInstance(appContext.reactContext!!) { name, body ->
            val nonNullBody = body ?: emptyMap()
            sendEvent(name, nonNullBody)
        }
    service.start(options)
    }

    Function("stop") {
        val service =
            ExpoSpeechService.getInstance(appContext.reactContext!!) { name, body ->
                val nonNullBody = body ?: emptyMap()
                sendEvent(name, nonNullBody)
            }
        service.stop()
    }

    Function("getSupportedLocales") {
      getSupportedLocales(appContext.reactContext!!)
    }
  }

    private fun hasNotGrantedPermissions(): Boolean {
        return appContext.permissions?.hasGrantedPermissions(RECORD_AUDIO)?.not() ?: false
    }

    private fun getSupportedLocales(appContext: Context): List<String> {
        //  val speechRecognizer = SpeechRecognizer.createSpeechRecognizer(appContext)
        val languageList = mutableListOf<String>()
        val intent = Intent(RecognizerIntent.ACTION_GET_LANGUAGE_DETAILS)

        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                val supportedLanguages = intent?.getStringArrayListExtra(RecognizerIntent.EXTRA_SUPPORTED_LANGUAGES)
                supportedLanguages?.let { languageList.addAll(it) }
                appContext.unregisterReceiver(this)
            }
        }

        appContext.registerReceiver(receiver, IntentFilter(RecognizerIntent.ACTION_GET_LANGUAGE_DETAILS))
        appContext.sendBroadcast(intent)

        // Return the list (this might be empty initially and populated later)
        return languageList
    }
}

class PermissionsException(message: String) : CodedException(message)
