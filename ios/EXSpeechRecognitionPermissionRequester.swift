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
    SFSpeechRecognizer.requestAuthorization { status in
      if status != .authorized {
        resolve(self.permissionsResult(
          speechPermission: status,
          recordPermission: AVAudioSession.sharedInstance().recordPermission
        ))
        return
      }
      AVAudioSession.sharedInstance().requestRecordPermission { authorized in
        resolve(self.permissionsResult(
          speechPermission: status,
          recordPermission: authorized ? .granted : .denied
        ))
      }
    }
  }

  public func getPermissions() -> [AnyHashable: Any] {
    return permissionsResult(
      speechPermission: SFSpeechRecognizer.authorizationStatus(),
      recordPermission: AVAudioSession.sharedInstance().recordPermission
    )
  }

  private func permissionsResult(
    speechPermission: SFSpeechRecognizerAuthorizationStatus,
    recordPermission: AVAudioSession.RecordPermission
  ) -> [AnyHashable: Any] {
    var status: EXPermissionStatus

    if speechPermission == .authorized && recordPermission == .granted {
      status = EXPermissionStatusGranted
    } else if speechPermission == .denied || recordPermission == .denied
      || speechPermission == .restricted
    {
      status = EXPermissionStatusDenied
    } else {
      status = EXPermissionStatusUndetermined
    }

    return [
      "status": status.rawValue,
      "restricted": speechPermission == .restricted,
    ]
  }
}
