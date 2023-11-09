import ExpoModulesCore
import AVFoundation
import Speech


struct SpeechRecognitionOptions : Record {
    @Field
    var interimResults: Bool = false

    @Field
    var lang: String = "en-US"

    // @Field
    // var continuous: Bool? = false

    @Field 
    var maxAlternatives: Int = 1
}

public class ExpoSpeechRecognitionModule: Module {

    var speechRecognizer: ExpoSpeechRecognizer?
    
    
    nonisolated private func transcribe(_ message: String) {
        Task { @MainActor in
            // Update the transcript
            // transcript = message

            // Call the sendEvent function with an event name and data
            sendEvent("result", ["transcript": message])
        }
    }

    public func definition() -> ModuleDefinition {
        // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
        // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
        // The module will be accessible from `requireNativeModule('ExpoSpeechRecognition')` in JavaScript.
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
            "_results"
        )
        
        /** Start recognition with args: lang, interimResults, maxAlternatives */
        Function("start") { (options: SpeechRecognitionOptions) in
            Task {
                // Stop transcribing, if applicable
                await speechRecognizer?.stop()
                
                let currentLocale = await speechRecognizer?.getLocale()
                
                // re-create the speech recognizer when locales change
                if (currentLocale != options.lang) {
                    speechRecognizer = ExpoSpeechRecognizer(lang: options.lang)
                    await speechRecognizer?.setDelegate(self)
                }

                guard await speechRecognizer?.start() != nil else {
                    sendEvent("error", [
                        "code": "permissions",
                        "message": "Speech recognition wasn't able to start"
                    ])
                    return
                }
                sendEvent("start")
            }
        }
    }
}

extension ExpoSpeechRecognitionModule: ExpoSpeechRecognitionEventDelegate {
    func onStart() {
        sendEvent("start")
    }
    func onResult(val: SFSpeechRecognitionResult) {
        if (val.isFinal) {
            sendEvent("_results", [
                "results": val.transcriptions.map { $0.formattedString }
            ])
        } else {
            sendEvent("_partialresults", [
                "results": val.transcriptions.map { $0.formattedString }
            ])
        }
    }
    func onError(val: Error) {
        sendEvent("error", [
            "code": "error",
            "message": val.localizedDescription
        ])
    }
    func onEnd() {
        sendEvent("end")
    }
}
