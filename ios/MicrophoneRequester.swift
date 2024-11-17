import ExpoModulesCore

public class MicrophoneRequester: NSObject, EXPermissionsRequester {
  static public func permissionType() -> String {
    return "microphone"
  }

  public func requestPermissions(
    resolver resolve: @escaping EXPromiseResolveBlock, rejecter reject: EXPromiseRejectBlock
  ) {
    AVAudioSession.sharedInstance().requestRecordPermission { authorized in
      resolve(self.getPermissions())
    }
  }

  public func getPermissions() -> [AnyHashable: Any] {
    var status: EXPermissionStatus

    let recordPermission = AVAudioSession.sharedInstance().recordPermission

    if recordPermission == .granted {
      status = EXPermissionStatusGranted
    } else if recordPermission == .denied {
      status = EXPermissionStatusDenied
    } else {
      status = EXPermissionStatusUndetermined
    }

    return [
      "status": status.rawValue
    ]
  }
}
