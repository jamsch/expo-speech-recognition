import ExpoModulesCore

public class MicrophoneRequester: NSObject, EXPermissionsRequester {
  static public func permissionType() -> String {
    return "microphone"
  }

  public func requestPermissions(
    resolver resolve: @escaping EXPromiseResolveBlock, rejecter reject: EXPromiseRejectBlock
  ) {
    AVAudioSession.sharedInstance().requestRecordPermission { authorized in
      resolve(self.permissionsResult(recordPermission: authorized ? .granted : .denied))
    }
  }

  public func getPermissions() -> [AnyHashable: Any] {
    return permissionsResult(recordPermission: AVAudioSession.sharedInstance().recordPermission)
  }

  private func permissionsResult(recordPermission: AVAudioSession.RecordPermission) -> [AnyHashable: Any] {
    var status: EXPermissionStatus

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
