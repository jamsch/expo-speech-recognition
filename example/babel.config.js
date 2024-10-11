const path = require("path");
module.exports = (api) => {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      "react-native-reanimated/plugin",
      [
        "module-resolver",
        {
          extensions: [".tsx", ".ts", ".js", ".json"],
          alias: {
            // For development, we want to alias the library to the source
            "expo-speech-recognition": path.join(
              __dirname,
              "..",
              "src",
              "index.ts",
            ),
          },
        },
      ],
    ],
  };
};
