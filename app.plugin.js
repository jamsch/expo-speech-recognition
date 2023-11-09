const {
  withAndroidManifest,
  AndroidConfig,
  withPlugins,
  createRunOncePlugin,
} = require("expo/config-plugins");

/**
 * @type {import("expo/config-plugins").ConfigPlugin}
 */
const withAndroidPackageVisibilityFiltering = (config) => {
  return withAndroidManifest(config, (config) => {
    // Check if the manifest already contains the intent filter
    if (
      Array.isArray(config.modResults.manifest.queries) &&
      config.modResults.manifest.queries.some((query) => {
        return (
          query.package?.[0]?.$?.["android:name"] ===
          "com.google.android.googlequicksearchbox"
        );
      })
    ) {
      return config;
    }

    /**
       Appends the following to our AndroidManifest:
       <queries>
          <package android:name="com.google.android.googlequicksearchbox" />
          <intent>
              <action android:name="android.speech.RecognitionService" />
          </intent>
      </queries>
       */
    config.modResults.manifest.queries = [
      ...(config.modResults.manifest.queries || []),
      {
        package: {
          $: { "android:name": "com.google.android.googlequicksearchbox" },
        },
        intent: {
          action: {
            $: { "android:name": "android.speech.RecognitionService" },
          },
        },
      },
    ];
    return config;
  });
};

/**
 * @type {import("expo/config-plugins").ConfigPlugin<{microphonePermission?: string; speechRecognitionPermission?: string;}>}
 */
const withExpoSpeechRecognition = (config, props) => {
  if (!config.ios) {
    config.ios = {};
  }

  if (!config.ios.infoPlist) {
    config.ios.infoPlist = {};
  }

  config.ios.infoPlist.NSSpeechRecognitionUsageDescription =
    props.speechRecognitionPermission ||
    config.ios.infoPlist.NSSpeechRecognitionUsageDescription ||
    "Allow $(PRODUCT_NAME) to use speech recognition.";

  config.ios.infoPlist.NSMicrophoneUsageDescription =
    props.microphonePermission ||
    config.ios.infoPlist.NSMicrophoneUsageDescription ||
    "Allow $(PRODUCT_NAME) to use the microphone.";

  return withPlugins(config, [
    // Android permissions
    [
      AndroidConfig.Permissions.withPermissions,
      ["android.permission.RECORD_AUDIO"],
    ],
    // Android package visibility filtering (for the Google App "com.google.android.googlequicksearchbox")
    withAndroidPackageVisibilityFiltering,
  ]);
};

module.exports = createRunOncePlugin(
  withExpoSpeechRecognition,
  "expo-speech-recognition",
  "1.0.0",
);
