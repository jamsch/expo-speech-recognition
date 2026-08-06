/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "../..");
const moduleConfigPath = path.join(packageRoot, "expo-module.config.json");
const harmonySourcePath = path.join(
  packageRoot,
  "harmony/src/main/ets/Index.ets",
);

const moduleConfig = JSON.parse(fs.readFileSync(moduleConfigPath, "utf8"));
const harmonySource = fs.readFileSync(harmonySourcePath, "utf8");

describe("Harmony Expo module contract", () => {
  it("is discoverable by Expo autolinking", () => {
    expect(moduleConfig.platforms).toContain("harmony");
    expect(moduleConfig.harmony).toMatchObject({
      modules: ["ExpoSpeechRecognition"],
      arktsPackageClass: "ExpoSpeechRecognitionHarmonyPackage",
      ohPackageName: "@bitfun/expo-speech-recognition-harmony",
      harName: "expo_speech_recognition_harmony.har",
      minApi: 22,
    });
  });

  it("exposes every method in the community native module API", () => {
    const methods = [
      "start",
      "stop",
      "abort",
      "requestPermissionsAsync",
      "getPermissionsAsync",
      "requestMicrophonePermissionsAsync",
      "getMicrophonePermissionsAsync",
      "requestSpeechRecognizerPermissionsAsync",
      "getSpeechRecognizerPermissionsAsync",
      "getStateAsync",
      "getSupportedLocales",
      "getSpeechRecognitionServices",
      "getDefaultRecognitionService",
      "getAssistantService",
      "supportsOnDeviceRecognition",
      "supportsRecording",
      "isRecognitionAvailable",
      "androidTriggerOfflineModelDownload",
      "setCategoryIOS",
      "getAudioSessionCategoryAndOptionsIOS",
      "setAudioSessionActiveIOS",
    ];

    for (const method of methods) {
      expect(harmonySource).toMatch(
        new RegExp(String.raw`\.(?:asyncFunction|function)\('${method}'`),
      );
    }
    expect(harmonySource).not.toContain("transcribeAudioFileAsync");
  });

  it("registers every public native event", () => {
    const events = [
      "audiostart",
      "audioend",
      "end",
      "error",
      "nomatch",
      "result",
      "soundstart",
      "soundend",
      "speechstart",
      "speechend",
      "start",
      "languagedetection",
      "volumechange",
    ];

    for (const event of events) {
      expect(harmonySource).toContain(`.event('${event}')`);
    }
  });

  it("uses the community result and audio event payload shapes", () => {
    expect(harmonySource).toContain("confidence: -1");
    expect(harmonySource).toContain("segments: new Array<ExpoValue>()");
    expect(harmonySource).toContain(
      "this.safeEmit('audiostart', { uri: null })",
    );
    expect(harmonySource).toContain("this.safeEmit('audioend', { uri: null })");
    expect(harmonySource).toContain("type RecognitionState = 'inactive'");
  });

  it("invalidates an asynchronous start when stop wins before engine creation", () => {
    expect(harmonySource).toContain(
      "return this.generation === expectedGeneration && this.state === 'starting';",
    );

    const stopStart = harmonySource.indexOf(
      "private stopFromJavaScript(): void",
    );
    const stopEnd = harmonySource.indexOf(
      "private async stopAndFinish(): Promise<void>",
    );
    const stopImplementation = harmonySource.slice(stopStart, stopEnd);
    expect(stopImplementation).toContain(
      "if (this.state === 'starting' && this.engine === null)",
    );
    expect(stopImplementation.indexOf("this.finishSession();")).toBeLessThan(
      stopImplementation.indexOf("this.state = 'stopping';"),
    );
  });

  it("allows an active session to abort and restart before native cleanup finishes", () => {
    expect(harmonySource).toContain(
      "private cleanupPromise: Promise<void> = Promise.resolve();",
    );

    const startSessionStart = harmonySource.indexOf(
      "private async startSession(",
    );
    const startSessionEnd = harmonySource.indexOf(
      "private async createEngine(",
    );
    const startSessionImplementation = harmonySource.slice(
      startSessionStart,
      startSessionEnd,
    );
    expect(startSessionImplementation).toContain("await this.cleanupPromise;");

    const finishStart = harmonySource.indexOf("private finishSession(): void");
    const finishEnd = harmonySource.indexOf("private cancelNativeWork(): void");
    const finishImplementation = harmonySource.slice(finishStart, finishEnd);
    expect(finishStart).toBeGreaterThan(-1);
    expect(finishImplementation).toContain("const capturer = this.capturer;");
    expect(finishImplementation).toContain("const engine = this.engine;");
    expect(finishImplementation).toContain("this.capturer = null;");
    expect(finishImplementation).toContain("this.engine = null;");
    expect(finishImplementation).toContain(
      "this.releaseDetachedSession(capturer, engine)",
    );
    expect(finishImplementation).not.toContain("await this.stopCapture();");

    const detachEngine = finishImplementation.indexOf("this.engine = null;");
    const queueCleanup = finishImplementation.indexOf(
      "this.cleanupPromise = this.cleanupPromise.then(",
    );
    const emitEnd = finishImplementation.indexOf(
      "if (shouldEmitEnd) this.safeEmit('end', null);",
    );
    expect(detachEngine).toBeLessThan(queueCleanup);
    expect(queueCleanup).toBeLessThan(emitEnd);
  });

  it("does not contain machine-local paths or DevEco configuration", () => {
    const files = [
      moduleConfigPath,
      harmonySourcePath,
      path.join(packageRoot, "harmony/oh-package.json5"),
    ];
    const contents = files
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n");

    expect(contents).not.toMatch(/\/Users\//);
    expect(contents).not.toMatch(/\/Applications\/DevEco-Studio/);
    expect(
      fs.existsSync(path.join(packageRoot, "harmony/deveco-cli.toml")),
    ).toBe(false);
  });
});
