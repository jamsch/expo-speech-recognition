import ExpoModulesCore
import Speech

public class SpeechRecognizerRequester: NSObject, EXPermissionsRequester {
  static public func permissionType() -> String {
    return "speechRecognizer"
  }

  public func requestPermissions(
    resolver resolve: @escaping EXPromiseResolveBlock, rejecter reject: EXPromiseRejectBlock
  ) {
    SFSpeechRecognizer.requestAuthorization { status in
      resolve(self.getPermissions())
    }
  }

  public func getPermissions() -> [AnyHashable: Any] {
    var status: EXPermissionStatus

    let speechPermission = SFSpeechRecognizer.authorizationStatus()

    if speechPermission == .authorized {
      status = EXPermissionStatusGranted
    } else if speechPermission == .denied || speechPermission == .restricted {
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
