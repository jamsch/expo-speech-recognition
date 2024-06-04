import ExpoModulesCore

struct SpeechRecognitionOptions: Record {
  @Field
  var interimResults: Bool = false

  @Field
  var lang: String = "en-US"

  @Field
  var continuous: Bool = false

  @Field
  var maxAlternatives: Int = 1

  @Field
  var contextualStrings: [String] = []

  @Field
  var requiresOnDeviceRecognition: Bool = false

  @Field
  var addsPunctuation: Bool = false
}
