/**
 * ExpoSpeechRecognition for HarmonyOS.
 *
 * The module keeps the public API and event payloads of the community
 * expo-speech-recognition package. Live sessions capture 16 kHz mono signed-16
 * PCM through Audio Kit and stream 640-byte frames into Core Speech Kit. File
 * sessions accept local raw PCM or RIFF/WAVE files with the same audio format.
 */
import type { RNPackageContext } from '@rnoh/react-native-openharmony';
import { RNOHPackage } from '@rnoh/react-native-openharmony';
import type { AppContext, ExpoValue } from '@expo/expo-modules-core';
import {
  Module,
  ModuleDefinition,
  expoRoute3ModuleRegistry,
} from '@expo/expo-modules-core';
import { speechRecognizer } from '@kit.CoreSpeechKit';
import audio from '@ohos.multimedia.audio';
import fs from '@ohos.file.fs';
import abilityAccessCtrl from '@ohos.abilityAccessCtrl';
import type { Permissions } from '@ohos.abilityAccessCtrl';

const MODULE_NAME: string = 'ExpoSpeechRecognition';
const ASR_SYSCAP: string = 'SystemCapability.AI.SpeechRecognizer';
const AUDIO_SYSCAP: string = 'SystemCapability.Multimedia.Audio.Capturer';
const MICROPHONE_PERMISSION: Permissions = 'ohos.permission.MICROPHONE';
const FRAME_BYTES: number = 640;
const DEFAULT_LANGUAGE: string = 'en-US';
const DEFAULT_CHUNK_DELAY_MS: number = 20;
const PCM_16BIT_ANDROID_ENCODING: number = 2;

type RecognitionState = 'inactive' | 'starting' | 'recognizing' | 'stopping';
type SessionKind = 'microphone' | 'audioFile';

interface AudioSourceOptions {
  uri: string;
  audioChannels?: number;
  audioEncoding?: number;
  sampleRate?: number;
  chunkDelayMillis?: number;
}

interface RecordingOptions {
  persist?: boolean;
}

interface RecognitionOptions {
  lang?: string;
  interimResults?: boolean;
  maxAlternatives?: number;
  contextualStrings?: Array<string>;
  continuous?: boolean;
  requiresOnDeviceRecognition?: boolean;
  addsPunctuation?: boolean;
  audioSource?: AudioSourceOptions;
  recordingOptions?: RecordingOptions;
}

interface PermissionResponse {
  status: string;
  granted: boolean;
  canAskAgain: boolean;
  expires: string;
}

interface NativeError {
  code?: number;
  message?: string;
}

interface AudioFileData {
  bytes: Uint8Array;
  sampleRate: number;
  channels: number;
  sampleBits: number;
  chunkDelayMillis: number;
}

interface RecognitionResultItemPayload {
  transcript: string;
  confidence: number;
  segments: Array<ExpoValue>;
}

interface RecognitionResultPayload {
  isFinal: boolean;
  results: Array<RecognitionResultItemPayload>;
}

interface RecognitionErrorPayload {
  error: string;
  message: string;
  code?: number;
}

interface RecognitionOwner {
  onNativeStart(sessionId: string, eventMessage: string): void;
  onNativeEvent(sessionId: string, eventCode: number, eventMessage: string): void;
  onNativeResult(sessionId: string, result: speechRecognizer.SpeechRecognitionResult): void;
  onNativeComplete(sessionId: string, eventMessage: string): void;
  onNativeError(sessionId: string, errorCode: number, errorMessage: string): void;
}

class RecognitionListenerAdapter implements speechRecognizer.RecognitionListener {
  private owner: RecognitionOwner;

  constructor(owner: RecognitionOwner) {
    this.owner = owner;
  }

  onStart(sessionId: string, eventMessage: string): void {
    this.owner.onNativeStart(sessionId, eventMessage);
  }

  onEvent(sessionId: string, eventCode: number, eventMessage: string): void {
    this.owner.onNativeEvent(sessionId, eventCode, eventMessage);
  }

  onResult(sessionId: string, result: speechRecognizer.SpeechRecognitionResult): void {
    this.owner.onNativeResult(sessionId, result);
  }

  onComplete(sessionId: string, eventMessage: string): void {
    this.owner.onNativeComplete(sessionId, eventMessage);
  }

  onError(sessionId: string, errorCode: number, errorMessage: string): void {
    this.owner.onNativeError(sessionId, errorCode, errorMessage);
  }
}

class ExpoSpeechRecognitionModule extends Module implements RecognitionOwner {
  static readonly NAME: string = MODULE_NAME;
  private readonly moduleDefinition: ModuleDefinition;

  private state: RecognitionState = 'inactive';
  private generation: number = 0;
  private sessionKind: SessionKind | null = null;
  private sessionId: string = '';
  private engine: speechRecognizer.SpeechRecognitionEngine | null = null;
  private capturer: audio.AudioCapturer | null = null;
  private audioRemainder: Uint8Array = new Uint8Array(0);
  private pendingFile: AudioFileData | null = null;
  private lastTranscript: string = '';
  private hasFinalResult: boolean = false;
  private reportInterimResults: boolean = false;
  private emittedAudioStart: boolean = false;
  private emittedAudioEnd: boolean = false;
  private emittedEnd: boolean = false;
  private cleanupPromise: Promise<void> = Promise.resolve();
  private readonly readDataCallback: (buffer: ArrayBuffer) => void;

  constructor(appContext: AppContext) {
    super(appContext);
    this.readDataCallback = (buffer: ArrayBuffer): void => this.writeCapturedAudio(buffer);
    this.moduleDefinition = new ModuleDefinition(ExpoSpeechRecognitionModule.NAME)
      .event('audiostart')
      .event('audioend')
      .event('end')
      .event('error')
      .event('nomatch')
      .event('result')
      .event('soundstart')
      .event('soundend')
      .event('speechstart')
      .event('speechend')
      .event('start')
      .event('languagedetection')
      .event('volumechange')
      .function('start', (args: ExpoValue[]): ExpoValue => {
        this.startFromJavaScript(args[0] as RecognitionOptions);
        return undefined;
      }, 1, 1)
      .function('stop', (_args: ExpoValue[]): ExpoValue => {
        this.stopFromJavaScript();
        return undefined;
      })
      .function('abort', (_args: ExpoValue[]): ExpoValue => {
        this.abortFromJavaScript();
        return undefined;
      })
      .asyncFunction('requestPermissionsAsync', async (_args: ExpoValue[]): Promise<ExpoValue> => {
        return await this.requestMicrophonePermission();
      })
      .asyncFunction('getPermissionsAsync', async (_args: ExpoValue[]): Promise<ExpoValue> => {
        return await this.getMicrophonePermission();
      })
      .asyncFunction('requestMicrophonePermissionsAsync', async (_args: ExpoValue[]): Promise<ExpoValue> => {
        return await this.requestMicrophonePermission();
      })
      .asyncFunction('getMicrophonePermissionsAsync', async (_args: ExpoValue[]): Promise<ExpoValue> => {
        return await this.getMicrophonePermission();
      })
      .asyncFunction('requestSpeechRecognizerPermissionsAsync', async (_args: ExpoValue[]): Promise<ExpoValue> => {
        return this.speechRecognizerPermission();
      })
      .asyncFunction('getSpeechRecognizerPermissionsAsync', async (_args: ExpoValue[]): Promise<ExpoValue> => {
        return this.speechRecognizerPermission();
      })
      .asyncFunction('getStateAsync', async (_args: ExpoValue[]): Promise<ExpoValue> => this.state)
      .asyncFunction('getSupportedLocales', async (_args: ExpoValue[]): Promise<ExpoValue> => {
        return await this.getSupportedLocales();
      }, 0, 1)
      .function('getSpeechRecognitionServices', (_args: ExpoValue[]): ExpoValue => {
        return new Array<string>();
      })
      .function('getDefaultRecognitionService', (_args: ExpoValue[]): ExpoValue => {
        return { packageName: '' };
      })
      .function('getAssistantService', (_args: ExpoValue[]): ExpoValue => {
        return { packageName: '' };
      })
      .function('supportsOnDeviceRecognition', (_args: ExpoValue[]): ExpoValue => {
        return canIUse(ASR_SYSCAP);
      })
      .function('supportsRecording', (_args: ExpoValue[]): ExpoValue => false)
      .function('isRecognitionAvailable', (_args: ExpoValue[]): ExpoValue => this.available())
      .asyncFunction('androidTriggerOfflineModelDownload', async (_args: ExpoValue[]): Promise<ExpoValue> => {
        throw new Error('androidTriggerOfflineModelDownload is not supported on HarmonyOS.');
      }, 1, 1)
      .function('setCategoryIOS', (_args: ExpoValue[]): ExpoValue => undefined, 1, 1)
      .function('getAudioSessionCategoryAndOptionsIOS', (_args: ExpoValue[]): ExpoValue => {
        return {
          category: 'playAndRecord',
          categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
          mode: 'measurement',
        };
      })
      .function('setAudioSessionActiveIOS', (_args: ExpoValue[]): ExpoValue => undefined, 1, 2);
  }

  override definition(): ModuleDefinition {
    return this.moduleDefinition;
  }

  override onDestroy(): void {
    this.cancelNativeWork();
  }

  private available(): boolean {
    return canIUse(ASR_SYSCAP) && canIUse(AUDIO_SYSCAP);
  }

  private safeEmit(name: string, payload: ExpoValue): void {
    try {
      if (this.appContext.isActive()) this.emit(name, payload);
    } catch (error) {
      console.warn(
        '[ExpoHarmonyNative] ExpoSpeechRecognition emit(' +
          name +
          ') failed: ' +
          JSON.stringify(error),
      );
    }
  }

  private normalizeLanguage(language?: string): string {
    if (language === undefined || language.length === 0) return DEFAULT_LANGUAGE;
    const normalized: string = language.replace('_', '-');
    if (normalized.toLowerCase() === 'zh') return 'zh-CN';
    if (normalized.toLowerCase() === 'en') return 'en-US';
    return normalized;
  }

  private granted(canAskAgain: boolean = true): PermissionResponse {
    return { status: 'granted', granted: true, canAskAgain: canAskAgain, expires: 'never' };
  }

  private denied(canAskAgain: boolean = true): PermissionResponse {
    return { status: 'denied', granted: false, canAskAgain: canAskAgain, expires: 'never' };
  }

  private speechRecognizerPermission(): PermissionResponse {
    // HarmonyOS does not expose a second speech-recognizer permission. This
    // mirrors the community module's Android behavior.
    return this.granted(false);
  }

  private async getMicrophonePermission(): Promise<PermissionResponse> {
    try {
      const tokenId: number = this.appContext.uiAbilityContext.applicationInfo.accessTokenId;
      const status = await abilityAccessCtrl.createAtManager()
        .checkAccessToken(tokenId, MICROPHONE_PERMISSION);
      return status === abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED
        ? this.granted()
        : this.denied();
    } catch (_error) {
      return this.denied();
    }
  }

  private async requestMicrophonePermission(): Promise<PermissionResponse> {
    try {
      const result = await abilityAccessCtrl.createAtManager().requestPermissionsFromUser(
        this.appContext.uiAbilityContext,
        [MICROPHONE_PERMISSION],
      );
      const granted: boolean =
        result.authResults[0] === abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED;
      const dialogWasShown: boolean =
        result.dialogShownResults === undefined || result.dialogShownResults[0] === true;
      return granted ? this.granted() : this.denied(dialogWasShown);
    } catch (_error) {
      return this.denied();
    }
  }

  private startFromJavaScript(options: RecognitionOptions): void {
    if (this.state !== 'inactive') {
      this.safeEmit('error', {
        error: 'busy',
        message: 'A speech recognition session is already active.',
        code: -1,
      });
      return;
    }

    if (!this.available()) {
      this.safeEmit('error', {
        error: 'service-not-allowed',
        message: 'HarmonyOS Core Speech Kit and Audio Capturer are required.',
        code: -1,
      });
      this.safeEmit('end', null);
      return;
    }

    this.beginSession(options);
    const expectedGeneration: number = this.generation;
    this.startSession(options, expectedGeneration).catch((error: Object): void => {
      if (!this.isCurrentGeneration(expectedGeneration)) return;
      this.finishWithError(
        this.mapErrorCode(this.errorCode(error), this.errorMessage(error)),
        this.errorMessage(error),
        this.errorCode(error),
      );
    });
  }

  private beginSession(options: RecognitionOptions): void {
    this.generation = this.generation + 1;
    this.state = 'starting';
    this.sessionKind = options.audioSource === undefined ? 'microphone' : 'audioFile';
    this.sessionId =
      'expo-asr-' + this.sessionKind + '-' + Date.now().toString() + '-' + this.generation.toString();
    this.lastTranscript = '';
    this.hasFinalResult = false;
    this.reportInterimResults = options.interimResults === true;
    this.audioRemainder = new Uint8Array(0);
    this.pendingFile = null;
    this.emittedAudioStart = false;
    this.emittedAudioEnd = false;
    this.emittedEnd = false;
  }

  private isCurrentGeneration(expectedGeneration: number): boolean {
    // Async permission/file/engine work belongs only to the pending start that
    // created it. In particular, a stop() that wins this race must prevent a
    // late engine from being attached and started.
    return this.generation === expectedGeneration && this.state === 'starting';
  }

  private isActiveSession(expectedSessionId: string): boolean {
    return expectedSessionId === this.sessionId && this.state !== 'inactive';
  }

  private async startSession(
    options: RecognitionOptions,
    expectedGeneration: number,
  ): Promise<void> {
    // A previous session may have emitted `end` after detaching its native
    // resources but before Audio Capturer has finished releasing them. A new
    // generation can be created immediately, but it must not acquire native
    // resources until that detached cleanup is complete.
    await this.cleanupPromise;
    if (!this.isCurrentGeneration(expectedGeneration)) return;

    const permission: PermissionResponse = await this.getMicrophonePermission();
    if (!this.isCurrentGeneration(expectedGeneration)) return;
    if (!permission.granted) {
      this.finishWithError(
        'not-allowed',
        'Microphone permission has not been granted.',
        -1,
      );
      return;
    }

    if (options.recordingOptions?.persist === true) {
      this.finishWithError(
        'audio-capture',
        'Persisting speech-recognition audio is not supported on HarmonyOS.',
        -1,
      );
      return;
    }

    if (options.audioSource !== undefined) {
      try {
        this.pendingFile = await this.readAudioFile(options.audioSource);
      } catch (error) {
        if (this.isCurrentGeneration(expectedGeneration)) {
          this.finishWithError('audio-capture', this.errorMessage(error), this.errorCode(error));
        }
        return;
      }
      if (!this.isCurrentGeneration(expectedGeneration)) return;
    }

    let engine: speechRecognizer.SpeechRecognitionEngine;
    try {
      engine = await this.createEngine(options);
    } catch (error) {
      if (this.isCurrentGeneration(expectedGeneration)) {
        this.finishWithError(
          this.mapErrorCode(this.errorCode(error), this.errorMessage(error)),
          this.errorMessage(error),
          this.errorCode(error),
        );
      }
      return;
    }

    if (!this.isCurrentGeneration(expectedGeneration)) {
      engine.shutdown();
      return;
    }

    this.engine = engine;
    engine.setListener(new RecognitionListenerAdapter(this));
    try {
      engine.startListening(this.startParams());
    } catch (error) {
      this.finishWithError(
        this.mapErrorCode(this.errorCode(error), this.errorMessage(error)),
        this.errorMessage(error),
        this.errorCode(error),
      );
    }
  }

  private async createEngine(
    options: RecognitionOptions,
  ): Promise<speechRecognizer.SpeechRecognitionEngine> {
    const language: string = this.normalizeLanguage(options.lang);
    const offlineOnly: boolean = options.requiresOnDeviceRecognition === true;
    try {
      return await speechRecognizer.createEngine({
        language: language,
        online: offlineOnly ? 1 : 0,
      });
    } catch (error) {
      if (offlineOnly) throw new Error(this.errorMessage(error));
      console.warn(
        '[ExpoHarmonyNative] ExpoSpeechRecognition online engine failed; retrying offline: ' +
          JSON.stringify(error),
      );
      return await speechRecognizer.createEngine({ language: language, online: 1 });
    }
  }

  private startParams(): speechRecognizer.StartParams {
    return {
      sessionId: this.sessionId,
      audioInfo: {
        audioType: 'pcm',
        sampleRate: 16000,
        soundChannel: 1,
        sampleBit: 16,
      },
    };
  }

  private async queryLocales(online: number): Promise<Array<string>> {
    let engine: speechRecognizer.SpeechRecognitionEngine | null = null;
    try {
      engine = await speechRecognizer.createEngine({
        language: 'zh-CN',
        online: online,
      });
      return await engine.listLanguages({
        sessionId: 'expo-asr-locales-' + online.toString() + '-' + Date.now().toString(),
      });
    } catch (_error) {
      return new Array<string>();
    } finally {
      if (engine !== null) engine.shutdown();
    }
  }

  private async getSupportedLocales(): Promise<ExpoValue> {
    if (!canIUse(ASR_SYSCAP)) {
      return { locales: new Array<string>(), installedLocales: new Array<string>() };
    }
    if (this.state !== 'inactive') {
      throw new Error('Supported locales cannot be queried while recognition is active.');
    }

    const locales: Array<string> = await this.queryLocales(0);
    const installedLocales: Array<string> = await this.queryLocales(1);
    return {
      locales: locales.length > 0 ? locales : installedLocales,
      installedLocales: installedLocales,
    };
  }

  private async createCapturer(): Promise<audio.AudioCapturer> {
    const options: audio.AudioCapturerOptions = {
      streamInfo: {
        samplingRate: audio.AudioSamplingRate.SAMPLE_RATE_16000,
        channels: audio.AudioChannel.CHANNEL_1,
        sampleFormat: audio.AudioSampleFormat.SAMPLE_FORMAT_S16LE,
        encodingType: audio.AudioEncodingType.ENCODING_TYPE_RAW,
      },
      capturerInfo: {
        source: audio.SourceType.SOURCE_TYPE_VOICE_RECOGNITION,
        capturerFlags: 0,
      },
    };
    return await audio.createAudioCapturer(options);
  }

  private async startCapture(expectedSessionId: string): Promise<void> {
    try {
      const capturer: audio.AudioCapturer = await this.createCapturer();
      if (expectedSessionId !== this.sessionId || this.state !== 'recognizing') {
        await capturer.release();
        return;
      }
      this.capturer = capturer;
      capturer.on('readData', this.readDataCallback);
      await capturer.start();
      if (expectedSessionId !== this.sessionId || this.state !== 'recognizing') {
        await this.stopCapture();
        return;
      }
      this.emitAudioStart();
    } catch (error) {
      if (this.isActiveSession(expectedSessionId)) {
        this.finishWithError('audio-capture', this.errorMessage(error), this.errorCode(error));
      }
    }
  }

  private concat(left: Uint8Array, right: Uint8Array): Uint8Array {
    const combined = new Uint8Array(left.length + right.length);
    combined.set(left, 0);
    combined.set(right, left.length);
    return combined;
  }

  private writeCapturedAudio(buffer: ArrayBuffer): void {
    const engine = this.engine;
    if (engine === null || this.state !== 'recognizing') return;
    const combined: Uint8Array = this.concat(this.audioRemainder, new Uint8Array(buffer));
    let offset: number = 0;
    while (combined.length - offset >= FRAME_BYTES) {
      const frame = new Uint8Array(FRAME_BYTES);
      frame.set(combined.subarray(offset, offset + FRAME_BYTES));
      try {
        engine.writeAudio(this.sessionId, frame);
      } catch (error) {
        this.finishWithError('audio-capture', this.errorMessage(error), this.errorCode(error));
        return;
      }
      offset = offset + FRAME_BYTES;
    }
    const rest: number = combined.length - offset;
    this.audioRemainder = new Uint8Array(rest);
    if (rest > 0) this.audioRemainder.set(combined.subarray(offset));
  }

  private flushAudioRemainder(): void {
    if (this.audioRemainder.length === 0 || this.engine === null) return;
    const frame = new Uint8Array(FRAME_BYTES);
    frame.set(this.audioRemainder);
    this.engine.writeAudio(this.sessionId, frame);
    this.audioRemainder = new Uint8Array(0);
  }

  private stopFromJavaScript(): void {
    if (this.state === 'inactive') {
      this.safeEmit('end', null);
      return;
    }
    if (this.state === 'stopping') return;
    if (this.state === 'starting' && this.engine === null) {
      // No native engine exists to deliver onComplete after finish(). Ending
      // locally also increments generation, invalidating the pending async
      // start pipeline before it can create or attach an engine.
      this.finishSession();
      return;
    }
    this.state = 'stopping';
    this.stopAndFinish().catch((error: Object): void => {
      if (this.state !== 'inactive') {
        this.finishWithError('unknown', this.errorMessage(error), this.errorCode(error));
      }
    });
  }

  private async stopAndFinish(): Promise<void> {
    await this.stopCapture();
    this.pendingFile = null;
    this.flushAudioRemainder();
    this.engine?.finish(this.sessionId);
  }

  private abortFromJavaScript(): void {
    this.safeEmit('error', {
      error: 'aborted',
      message: 'Speech recognition aborted.',
      code: -1,
    });
    if (this.state === 'inactive') {
      this.safeEmit('end', null);
      return;
    }

    this.state = 'stopping';
    try {
      this.engine?.cancel(this.sessionId);
    } catch (_error) {
      // Cancellation is best-effort; cleanup below is authoritative.
    }
    this.finishSession();
  }

  private async stopCapture(): Promise<void> {
    const capturer = this.capturer;
    this.capturer = null;
    if (capturer === null) return;
    try {
      capturer.off('readData', this.readDataCallback);
    } catch (_error) {}
    try {
      await capturer.stop();
    } catch (_error) {}
    try {
      await capturer.release();
    } catch (_error) {}
    this.emitAudioEnd();
  }

  private async readAudioFile(options: AudioSourceOptions): Promise<AudioFileData> {
    if (options.uri.length === 0) throw new Error('audioSource.uri must not be empty.');
    if (options.uri.startsWith('http://') || options.uri.startsWith('https://')) {
      throw new Error('Remote audioSource URIs are not supported on HarmonyOS.');
    }

    let bytes: Uint8Array;
    if (options.uri.startsWith('asset://')) {
      const assetPath: string = options.uri.substring('asset://'.length);
      bytes = await this.appContext.uiAbilityContext.resourceManager
        .getRawFileContent('assets/' + assetPath);
    } else {
      const source: string = options.uri.startsWith('file://')
        ? options.uri.substring('file://'.length)
        : options.uri;
      const file = fs.openSync(source, fs.OpenMode.READ_ONLY);
      try {
        const stat = fs.statSync(file.fd);
        bytes = new Uint8Array(stat.size);
        let bytesRead: number = 0;
        while (bytesRead < bytes.length) {
          const readCount: number = fs.readSync(file.fd, bytes.subarray(bytesRead), {
            length: bytes.length - bytesRead,
          });
          if (readCount <= 0) {
            throw new Error(
              'The audioSource file ended before all declared bytes could be read.',
            );
          }
          bytesRead = bytesRead + readCount;
        }
      } finally {
        fs.closeSync(file);
      }
    }

    const chunkDelayMillis: number =
      options.chunkDelayMillis === undefined
        ? DEFAULT_CHUNK_DELAY_MS
        : Math.max(0, options.chunkDelayMillis);
    return this.parseAudioFile(bytes, options, chunkDelayMillis);
  }

  private readAscii(bytes: Uint8Array, offset: number, count: number): string {
    let output: string = '';
    for (let index: number = 0; index < count; index++) {
      output = output + String.fromCharCode(bytes[offset + index]);
    }
    return output;
  }

  private littleEndian16(bytes: Uint8Array, offset: number): number {
    return bytes[offset] | (bytes[offset + 1] << 8);
  }

  private littleEndian32(bytes: Uint8Array, offset: number): number {
    return (
      bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)
    ) >>> 0;
  }

  private parseAudioFile(
    bytes: Uint8Array,
    options: AudioSourceOptions,
    chunkDelayMillis: number,
  ): AudioFileData {
    if (
      bytes.length >= 12 &&
      this.readAscii(bytes, 0, 4) === 'RIFF' &&
      this.readAscii(bytes, 8, 4) === 'WAVE'
    ) {
      return this.parseWav(bytes, chunkDelayMillis);
    }

    const sampleRate: number = options.sampleRate ?? 16000;
    const channels: number = options.audioChannels ?? 1;
    const audioEncoding: number = options.audioEncoding ?? PCM_16BIT_ANDROID_ENCODING;
    if (sampleRate !== 16000 || channels !== 1 || audioEncoding !== PCM_16BIT_ANDROID_ENCODING) {
      throw new Error(
        'HarmonyOS raw audioSource input must be 16 kHz, mono, signed 16-bit little-endian PCM.',
      );
    }
    return {
      bytes: bytes,
      sampleRate: sampleRate,
      channels: channels,
      sampleBits: 16,
      chunkDelayMillis: chunkDelayMillis,
    };
  }

  private parseWav(bytes: Uint8Array, chunkDelayMillis: number): AudioFileData {
    let offset: number = 12;
    let audioFormat: number = 0;
    let channels: number = 0;
    let sampleRate: number = 0;
    let sampleBits: number = 0;
    let payload: Uint8Array | null = null;

    while (offset + 8 <= bytes.length) {
      const chunkName: string = this.readAscii(bytes, offset, 4);
      const chunkSize: number = this.littleEndian32(bytes, offset + 4);
      const payloadStart: number = offset + 8;
      const payloadEnd: number = payloadStart + chunkSize;
      if (payloadEnd > bytes.length) break;

      if (chunkName === 'fmt ' && chunkSize >= 16) {
        audioFormat = this.littleEndian16(bytes, payloadStart);
        channels = this.littleEndian16(bytes, payloadStart + 2);
        sampleRate = this.littleEndian32(bytes, payloadStart + 4);
        sampleBits = this.littleEndian16(bytes, payloadStart + 14);
      } else if (chunkName === 'data') {
        // Keep a view into the input buffer instead of temporarily holding a
        // second full copy of the WAV payload in memory.
        payload = bytes.subarray(payloadStart, payloadEnd);
      }
      offset = payloadEnd + (chunkSize % 2);
    }

    if (payload === null) throw new Error('The WAV audioSource has no data chunk.');
    if (audioFormat !== 1 || sampleRate !== 16000 || channels !== 1 || sampleBits !== 16) {
      throw new Error(
        'HarmonyOS WAV audioSource input must be PCM, 16 kHz, mono, and signed 16-bit.',
      );
    }
    return {
      bytes: payload,
      sampleRate: sampleRate,
      channels: channels,
      sampleBits: sampleBits,
      chunkDelayMillis: chunkDelayMillis,
    };
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise<void>((resolve) => {
      setTimeout(() => resolve(), milliseconds);
    });
  }

  private async feedPendingFile(expectedSessionId: string): Promise<void> {
    const source = this.pendingFile;
    const engine = this.engine;
    this.pendingFile = null;
    if (source === null || engine === null) return;

    await this.delay(0);
    if (expectedSessionId !== this.sessionId || this.state !== 'recognizing') return;
    this.emitAudioStart();
    let offset: number = 0;
    try {
      while (offset < source.bytes.length) {
        if (
          this.engine !== engine ||
          this.sessionId !== expectedSessionId ||
          this.state !== 'recognizing'
        ) {
          return;
        }
        const remaining: number = source.bytes.length - offset;
        const size: number = remaining >= FRAME_BYTES ? FRAME_BYTES : remaining;
        const frame = new Uint8Array(FRAME_BYTES);
        frame.set(source.bytes.subarray(offset, offset + size));
        engine.writeAudio(expectedSessionId, frame);
        offset = offset + size;
        await this.delay(source.chunkDelayMillis);
      }
      this.emitAudioEnd();
      engine.finish(expectedSessionId);
    } catch (error) {
      if (this.isActiveSession(expectedSessionId)) {
        this.finishWithError('audio-capture', this.errorMessage(error), this.errorCode(error));
      }
    }
  }

  onNativeStart(sessionId: string, _eventMessage: string): void {
    if (sessionId !== this.sessionId || this.state !== 'starting') return;
    this.state = 'recognizing';
    this.safeEmit('start', null);
    if (this.sessionKind === 'microphone') {
      this.startCapture(sessionId);
    } else {
      this.feedPendingFile(sessionId);
    }
  }

  onNativeEvent(sessionId: string, eventCode: number, _eventMessage: string): void {
    if (sessionId !== this.sessionId || this.state === 'inactive') return;
    if (eventCode === 1) this.emitAudioStart();
    if (eventCode === 3) this.emitAudioEnd();
  }

  onNativeResult(
    sessionId: string,
    result: speechRecognizer.SpeechRecognitionResult,
  ): void {
    if (sessionId !== this.sessionId || this.state === 'inactive') return;
    this.lastTranscript = result.result;
    if (result.isFinal) this.hasFinalResult = true;
    if (!result.isFinal && !this.reportInterimResults) return;
    if (result.result.length === 0) return;
    this.emitResult(result.result, result.isFinal);
  }

  onNativeComplete(sessionId: string, _eventMessage: string): void {
    if (sessionId !== this.sessionId || this.state === 'inactive') return;
    if (this.lastTranscript.length === 0) {
      this.safeEmit('nomatch', null);
    } else if (!this.hasFinalResult) {
      this.emitResult(this.lastTranscript, true);
    }
    this.finishSession();
  }

  onNativeError(sessionId: string, errorCode: number, errorMessage: string): void {
    if (sessionId !== this.sessionId || this.state === 'inactive') return;
    this.finishWithError(this.mapErrorCode(errorCode, errorMessage), errorMessage, errorCode);
  }

  private emitResult(transcript: string, isFinal: boolean): void {
    const alternative: RecognitionResultItemPayload = {
      transcript: transcript,
      confidence: -1,
      segments: new Array<ExpoValue>(),
    };
    const payload: RecognitionResultPayload = {
      isFinal: isFinal,
      results: [alternative],
    };
    this.safeEmit('result', payload);
  }

  private emitAudioStart(): void {
    if (this.emittedAudioStart) return;
    this.emittedAudioStart = true;
    this.safeEmit('audiostart', { uri: null });
  }

  private emitAudioEnd(): void {
    if (this.emittedAudioEnd || !this.emittedAudioStart) return;
    this.emittedAudioEnd = true;
    this.safeEmit('audioend', { uri: null });
  }

  private mapErrorCode(code: number | undefined, message: string): string {
    const lower: string = message.toLowerCase();
    if (code === 1002200006 || lower.includes('busy')) return 'busy';
    if (lower.includes('permission') || lower.includes('not allowed')) return 'not-allowed';
    if (
      lower.includes('language') ||
      lower.includes('locale') ||
      lower.includes('model')
    ) {
      return 'language-not-supported';
    }
    if (lower.includes('network')) return 'network';
    if (lower.includes('speech') || lower.includes('empty') || lower.includes('no match')) {
      return 'no-speech';
    }
    if (code === 1002200003 || code === 1002200010) return 'audio-capture';
    if (
      code === 1002200001 ||
      code === 1002200002 ||
      code === 1002200007 ||
      code === 1002200008
    ) {
      return 'service-not-allowed';
    }
    return 'unknown';
  }

  private errorMessage(error: Object): string {
    const native = error as NativeError;
    return native.message === undefined ? JSON.stringify(error) : native.message;
  }

  private errorCode(error: Object): number | undefined {
    return (error as NativeError).code;
  }

  private finishWithError(code: string, message: string, nativeCode?: number): void {
    if (this.state === 'inactive') return;
    const payload: RecognitionErrorPayload = {
      error: code,
      message: message,
    };
    if (nativeCode !== undefined) payload.code = nativeCode;
    this.safeEmit('error', payload);
    this.finishSession();
  }

  private finishSession(): void {
    if (this.state === 'inactive') return;

    // Detach every piece of mutable session state before asynchronous native
    // cleanup starts. This lets abort(); start(...) create a new generation
    // immediately without the old cleanup shutting down or clearing it later.
    const capturer = this.capturer;
    const engine = this.engine;
    const shouldEmitAudioEnd: boolean = this.emittedAudioStart && !this.emittedAudioEnd;
    const shouldEmitEnd: boolean = !this.emittedEnd;
    if (capturer !== null) {
      try {
        capturer.off('readData', this.readDataCallback);
      } catch (_error) {}
    }

    this.state = 'inactive';
    this.generation = this.generation + 1;
    this.capturer = null;
    this.engine = null;
    this.pendingFile = null;
    this.audioRemainder = new Uint8Array(0);
    this.sessionKind = null;
    this.sessionId = '';
    this.emittedAudioEnd = true;
    this.emittedEnd = true;

    this.cleanupPromise = this.cleanupPromise.then(
      (): Promise<void> => this.releaseDetachedSession(capturer, engine),
    );

    if (shouldEmitAudioEnd) this.safeEmit('audioend', { uri: null });
    if (shouldEmitEnd) this.safeEmit('end', null);
  }

  private async releaseDetachedSession(
    capturer: audio.AudioCapturer | null,
    engine: speechRecognizer.SpeechRecognitionEngine | null,
  ): Promise<void> {
    if (capturer !== null) {
      try {
        await capturer.stop();
      } catch (_error) {}
      try {
        await capturer.release();
      } catch (_error) {}
    }
    if (engine !== null) {
      try {
        engine.shutdown();
      } catch (_error) {}
    }
  }

  private cancelNativeWork(): void {
    if (this.state === 'inactive') return;
    try {
      this.engine?.cancel(this.sessionId);
    } catch (_error) {}
    this.finishSession();
  }
}

export class ExpoSpeechRecognitionHarmonyPackage extends RNOHPackage {
  constructor(ctx: RNPackageContext) {
    super(ctx);
    expoRoute3ModuleRegistry.register(
      ExpoSpeechRecognitionModule.NAME,
      (appContext: AppContext): Module => new ExpoSpeechRecognitionModule(appContext),
    );
  }

  override getDebugName(): string {
    return 'expo-speech-recognition-harmony';
  }
}

export default ExpoSpeechRecognitionHarmonyPackage;
