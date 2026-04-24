import AVFoundation
import Foundation
import Speech

struct SpeechRecognitionOptions {
  var interimResults: Bool = false
  var lang: String = "en-US"
  var continuous: Bool = false
  var maxAlternatives: Int = 5
  var contextualStrings: [String]? = nil
  var requiresOnDeviceRecognition: Bool = false
  var addsPunctuation: Bool = false
  var recordingOptions: RecordingOptions? = nil
  var audioSource: AudioSourceOptions? = nil
  var iosTaskHint: IOSTaskHint? = nil
  var iosCategory: SetCategoryOptions? = nil
  var volumeChangeEventOptions: VolumeChangeEventOptions? = nil
  var iosVoiceProcessingEnabled: Bool? = false

  init(dictionary: [String: Any]) {
    interimResults = dictionary["interimResults"] as? Bool ?? false
    lang = dictionary["lang"] as? String ?? "en-US"
    continuous = dictionary["continuous"] as? Bool ?? false
    maxAlternatives = dictionary["maxAlternatives"] as? Int ?? 5
    contextualStrings = dictionary["contextualStrings"] as? [String]
    requiresOnDeviceRecognition =
      dictionary["requiresOnDeviceRecognition"] as? Bool ?? false
    addsPunctuation = dictionary["addsPunctuation"] as? Bool ?? false
    iosVoiceProcessingEnabled =
      dictionary["iosVoiceProcessingEnabled"] as? Bool ?? false

    // 这里把 RN 透传进来的弱类型字典收敛成强类型结构，避免识别核心层继续到处判断 Any。
    if let recordingOptions = dictionary["recordingOptions"] as? [String: Any] {
      self.recordingOptions = RecordingOptions(dictionary: recordingOptions)
    }

    if let audioSource = dictionary["audioSource"] as? [String: Any] {
      self.audioSource = AudioSourceOptions(dictionary: audioSource)
    }

    if let iosTaskHintValue = dictionary["iosTaskHint"] as? String {
      iosTaskHint = IOSTaskHint(rawValue: iosTaskHintValue)
    }

    if let iosCategory = dictionary["iosCategory"] as? [String: Any] {
      self.iosCategory = SetCategoryOptions(dictionary: iosCategory)
    }

    if let volumeOptions = dictionary["volumeChangeEventOptions"] as? [String: Any] {
      volumeChangeEventOptions = VolumeChangeEventOptions(dictionary: volumeOptions)
    }
  }
}

struct VolumeChangeEventOptions {
  var enabled: Bool? = false
  var intervalMillis: Int? = nil

  init(dictionary: [String: Any]) {
    enabled = dictionary["enabled"] as? Bool ?? false
    intervalMillis = dictionary["intervalMillis"] as? Int
  }
}

enum IOSTaskHint: String {
  case unspecified
  case dictation
  case search
  case confirmation

  var sfSpeechRecognitionTaskHint: SFSpeechRecognitionTaskHint {
    switch self {
    case .unspecified: return .unspecified
    case .dictation: return .dictation
    case .search: return .search
    case .confirmation: return .confirmation
    }
  }
}

struct RecordingOptions {
  var persist: Bool = false
  var outputDirectory: String? = nil
  var outputFileName: String? = nil
  var outputSampleRate: Double? = nil
  var outputEncoding: String? = nil

  init(dictionary: [String: Any]) {
    persist = dictionary["persist"] as? Bool ?? false
    outputDirectory = dictionary["outputDirectory"] as? String
    outputFileName = dictionary["outputFileName"] as? String

    if let outputSampleRate = dictionary["outputSampleRate"] as? Double {
      self.outputSampleRate = outputSampleRate
    } else if let outputSampleRate = dictionary["outputSampleRate"] as? NSNumber {
      self.outputSampleRate = outputSampleRate.doubleValue
    }

    outputEncoding = dictionary["outputEncoding"] as? String
  }
}

struct AudioSourceOptions {
  var uri: String = ""
  var audioEncoding: Int? = nil
  var sampleRate: Int? = 16000
  var audioChannels: Int? = 1
  var chunkDelayMillis: Int? = nil

  init(dictionary: [String: Any]) {
    uri = dictionary["uri"] as? String ?? ""
    audioEncoding = dictionary["audioEncoding"] as? Int
    sampleRate = dictionary["sampleRate"] as? Int ?? 16000
    audioChannels = dictionary["audioChannels"] as? Int ?? 1
    chunkDelayMillis = dictionary["chunkDelayMillis"] as? Int
  }
}

struct GetSupportedLocaleOptions {
  var androidRecognitionServicePackage: String? = nil
}

enum CategoryParam: String {
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

enum CategoryOptionsParam: String {
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

enum ModeParam: String {
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

struct SetCategoryOptions {
  var category: CategoryParam = .playAndRecord
  var categoryOptions: [CategoryOptionsParam] = [.duckOthers]
  var mode: ModeParam = .measurement

  init(dictionary: [String: Any]) {
    if let categoryValue = dictionary["category"] as? String,
      let category = CategoryParam(rawValue: categoryValue)
    {
      self.category = category
    }

    if let optionValues = dictionary["categoryOptions"] as? [String] {
      let parsedOptions = optionValues.compactMap(CategoryOptionsParam.init(rawValue:))
      if !parsedOptions.isEmpty {
        categoryOptions = parsedOptions
      }
    }

    if let modeValue = dictionary["mode"] as? String,
      let mode = ModeParam(rawValue: modeValue)
    {
      self.mode = mode
    }
  }
}

struct SetAudioSessionActiveOptions {
  var notifyOthersOnDeactivation: Bool? = true
}
