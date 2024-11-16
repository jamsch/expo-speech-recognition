// @ts-check
const {
  withAndroidManifest,
  AndroidConfig,
  withPlugins,
  createRunOncePlugin,
} = require("expo/config-plugins");

/**
 * @type {import("expo/config-plugins").ConfigPlugin<{ packages?: string[] }>}
 */
const withAndroidPackageVisibilityFiltering = (config, { packages = [] }) => {
  return withAndroidManifest(config, (config) => {
    // Default speech recognition packages
    const allPackages =
      packages.length > 0
        ? packages
        : [
            "com.google.android.googlequicksearchbox",
            // "com.samsung.android.bixby.agent",
            // "com.microsoft.cortana",
            // "com.nuance.balerion",
            // "com.htc.sense.hsp",
          ];

    // Add speech recognition packages to the manifest if not already present
    config.modResults.manifest.queries =
      config.modResults.manifest.queries || [];

    /**
       Appends the following to our AndroidManifest:
       <queries>
          <package android:name="com.google.android.googlequicksearchbox" />
          <intent>
              <action android:name="android.speech.RecognitionService" />
          </intent>
      </queries>
       */

    for (const pkg of allPackages) {
      if (
        !config.modResults.manifest.queries.some(
          (query) => query.package?.[0]?.$?.["android:name"] === pkg,
        )
      ) {
        config.modResults.manifest.queries.push({
          package: [{ $: { "android:name": pkg } }],
          intent: [
            {
              action: [
                {
                  $: { "android:name": "android.speech.RecognitionService" },
                },
              ],
            },
          ],
        });
      }
    }

    return config;
  });
};

/**
 * @type {import("expo/config-plugins").ConfigPlugin<{
 * microphonePermission?: string;
 * speechRecognitionPermission?: string;
 * androidSpeechServicePackages?: string[];
 * }|undefined>}
 */
const withExpoSpeechRecognition = (config, props) => {
  if (!config.ios) {
    config.ios = {};
  }

  if (!config.ios.infoPlist) {
    config.ios.infoPlist = {};
  }

  config.ios.infoPlist.NSSpeechRecognitionUsageDescription =
    props?.speechRecognitionPermission ||
    config.ios.infoPlist.NSSpeechRecognitionUsageDescription ||
    "Allow $(PRODUCT_NAME) to use speech recognition.";

  config.ios.infoPlist.NSMicrophoneUsageDescription =
    props?.microphonePermission ||
    config.ios.infoPlist.NSMicrophoneUsageDescription ||
    "Allow $(PRODUCT_NAME) to use the microphone.";

  return withPlugins(config, [
    // Android permissions
    [
      AndroidConfig.Permissions.withPermissions,
      ["android.permission.RECORD_AUDIO"],
    ],
    // Android package visibility filtering (for the Google App "com.google.android.googlequicksearchbox")
    [
      withAndroidPackageVisibilityFiltering,
      {
        packages: props?.androidSpeechServicePackages,
      },
    ],
  ]);
};

module.exports = createRunOncePlugin(
  withExpoSpeechRecognition,
  "expo-speech-recognition",
  "1.0.0",
);
