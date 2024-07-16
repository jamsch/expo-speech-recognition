import AppTrackingTransparency
import ExpoModulesCore
import Speech

public class EXSpeechRecognitionPermissionRequester: NSObject, EXPermissionsRequester {
  static public func permissionType() -> String {
    return "speechrecognition"
  }

  public func requestPermissions(
    resolver resolve: @escaping EXPromiseResolveBlock, rejecter reject: EXPromiseRejectBlock
  ) {
    if #available(iOS 14, *) {

    } else {
      resolve(self.getPermissions())
    }
  }

  public func getPermissions() -> [AnyHashable: Any] {
    var status: EXPermissionStatus
    let hasRecordPermission: Bool

    //    if #available(iOS 17.0, *) {
    //        hasRecordPermission = AVAudioApplication.recordPermission == .granted
    //    } else {
    hasRecordPermission = AVAudioSession.sharedInstance().recordPermission == .granted
    //    }
    let hasSpeechPermission = SFSpeechRecognizer.authorizationStatus() == .authorized

    if SFSpeechRecognizer.authorizationStatus() == .authorized && hasRecordPermission {
      status = EXPermissionStatusGranted
    } else if SFSpeechRecognizer.authorizationStatus() == .denied || !hasRecordPermission {
      status = EXPermissionStatusDenied
    } else {
      status = EXPermissionStatusUndetermined
    }

    return [
      "status": status.rawValue
    ]
  }
}
