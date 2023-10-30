const { withAndroidManifest } = require("expo/config-plugins");

/** Appends Android 11 Package visibility filtering to AndroidManifest */
const withExpoSpeechRecognition /*: ConfigPlugin*/ = (
  config /*: ExpoConfig*/,
) => {
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
          $: {
            "android:name": "com.google.android.googlequicksearchbox",
          },
        },
        intent: {
          action: {
            $: {
              "android:name": "android.speech.RecognitionService",
            },
          },
        },
      },
    ];
    return config;
  });
};

module.exports = withExpoSpeechRecognition;
