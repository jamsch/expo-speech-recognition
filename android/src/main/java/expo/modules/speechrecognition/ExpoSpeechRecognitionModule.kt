package expo.modules.speechrecognition

import android.Manifest.permission.RECORD_AUDIO
import android.content.Intent
import android.speech.RecognitionService
import expo.modules.interfaces.permissions.Permissions.askForPermissionsWithPermissionsManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class SpeechRecognitionOptions : Record {
  @Field val interimResults: Boolean? = false

  @Field val lang: String? = "en-US"

  // @Field
  // val continuous: Boolean? = false

  @Field val maxAlternatives: Number? = 1
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

        // Custom events

        // Called when the endpointer is ready for the user to start speaking.
        "_speechready",
        // Called when there's partial results
        "_partialresults",
        // Called when there's results (as a string array, not API compliant)
        "_results",
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
      if (appContext.reactContext == null) {
        val service =
            ExpoSpeechService.getInstance(appContext.reactContext!!) { name, body ->
              sendEvent(name, body)
            }
        service.start(options)
      }
    }

    // Defines a JavaScript function that always returns a Promise and whose native code
    // is by default dispatched on the different thread than the JavaScript runtime runs on.
    AsyncFunction("setValueAsync") { value: String ->
      // Send an event to JavaScript.
      sendEvent("onChange", mapOf("value" to value))
    }
  }

  private fun hasNotGrantedPermissions(): Boolean {
    return appContext.permissions?.hasGrantedPermissions(RECORD_AUDIO)?.not() ?: false
  }
}

class PermissionsException(message: String) : CodedException(message)
