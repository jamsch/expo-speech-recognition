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
  var contextualStrings: [String]? = nil

  @Field
  var requiresOnDeviceRecognition: Bool = false

  @Field
  var addsPunctuation: Bool = false

  @Field
  var recordingOptions: RecordingOptions? = nil

  @Field
  var audioSource: AudioSourceOptions? = nil
}

struct RecordingOptions: Record {
  @Field
  var persist: Bool = false

  @Field
  var outputFilePath: String? = nil
}

struct AudioSourceOptions: Record {
  @Field
  var uri: String = ""

  @Field
  var audioEncoding: Int? = nil

  @Field
  var sampleRate: Int? = 16000

  @Field
  var audioChannels: Int? = 1
}

struct GetSupportedLocaleOptions: Record {
  @Field
  var androidRecognitionServicePackage: String? = nil

  @Field
  var onDevice: Bool = false
}

enum CategoryParam: String, Enumerable {
  case ambient
  case soloAmbient
  case playback
  case record
  case playAndRecord
  case multiRoute

  var avCategory: AVAudioSession.Category {
    switch self {
    case .ambient: return .ambient
    case .soloAmbient: return .soloAmbient
    case .playback: return .playback
    case .record: return .record
    case .playAndRecord: return .playAndRecord
    case .multiRoute: return .multiRoute
    }
  }
}

enum CategoryOptionsParam: String, Enumerable {
  case mixWithOthers
  case duckOthers
  case interruptSpokenAudioAndMixWithOthers
  case allowBluetooth
  case allowBluetoothA2DP
  case allowAirPlay
  case defaultToSpeaker
  case overrideMutedMicrophoneInterruption

  var avCategoryOption: AVAudioSession.CategoryOptions {
    switch self {
    case .mixWithOthers: return .mixWithOthers
    case .duckOthers: return .duckOthers
    case .interruptSpokenAudioAndMixWithOthers: return .interruptSpokenAudioAndMixWithOthers
    case .allowBluetooth: return .allowBluetooth
    case .allowBluetoothA2DP: return .allowBluetoothA2DP
    case .allowAirPlay: return .allowAirPlay
    case .defaultToSpeaker: return .defaultToSpeaker
    case .overrideMutedMicrophoneInterruption:
      if #available(iOS 14.5, *) {
        return .overrideMutedMicrophoneInterruption
      } else {
        return .mixWithOthers
      }
    }
  }
}

enum ModeParam: String, Enumerable {
  case `default`
  case gameChat
  case measurement
  case moviePlayback
  case spokenAudio
  case videoChat
  case videoRecording
  case voiceChat
  case voicePrompt

  var avMode: AVAudioSession.Mode {
    switch self {
    case .default: return .default
    case .gameChat: return .gameChat
    case .measurement: return .measurement
    case .moviePlayback: return .moviePlayback
    case .spokenAudio: return .spokenAudio
    case .videoChat: return .videoChat
    case .videoRecording: return .videoRecording
    case .voiceChat: return .voiceChat
    case .voicePrompt: return .voicePrompt
    }
  }
}

struct SetCategoryOptions: Record {
  @Field
  var category: CategoryParam = .playAndRecord

  @Field
  var categoryOptions: [CategoryOptionsParam] = [.duckOthers]

  @Field
  var mode: ModeParam = .measurement
}
