# Loom 宿主可用的 React Native 原生模块改造方案

## 1. 目标

将当前库改造成一个 **不依赖 Expo 运行环境** 的标准 React Native 原生模块库

本方案的目标是得到一套干净的、可在 iOS 宿主和 Android 宿主中直接使用的实现。

本方案明确排除以下范围：

- `example`
- Expo 示例工程相关配置
- Expo config plugin
- Web 兼容
- 任何兼容 Expo 运行环境的保留设计

## 2. 结论

最终实现方式必须是：

1. 保留当前库中已有的语音识别核心实现
2. 删除全部 Expo Modules 相关桥接层
3. 重新实现一套标准 React Native 原生桥接层

这次改造的核心不是“兼容 Expo”，而是 **彻底脱离 Expo，落到纯 React Native Native Module 架构**。

## 3. 现状依据

### 3.1 当前库为什么不能直接在 Loom 宿主中使用

因为当前库的运行时桥接依赖 Expo Modules。

依据如下：

- JS 模块加载依赖 Expo
  - `src/ExpoSpeechRecognitionModule.ts`
  - `src/useSpeechRecognitionEvent.ts`
- TS 类型依赖 Expo
  - `src/ExpoSpeechRecognitionModule.types.ts`
- iOS 原生桥接依赖 `ExpoModulesCore`
  - `ios/ExpoSpeechRecognitionModule.swift`
  - `ios/EXSpeechRecognitionPermissionRequester.swift`
  - `ios/MicrophoneRequester.swift`
  - `ios/SpeechRecognizerRequester.swift`
- Android 原生桥接依赖 Expo Kotlin Module
  - `android/src/main/java/expo/modules/speechrecognition/ExpoSpeechRecognitionModule.kt`
- iOS Pod 依赖 Expo
  - `ios/ExpoSpeechRecognition.podspec`
- Android Gradle 依赖 Expo Modules Core 插件
  - `android/build.gradle`

只要这些桥接层还在，宿主就仍然需要 Expo Modules 运行环境，因此不能满足当前目标。

### 3.2 现有功能实现并不是都要重写

当前库中很多能力本身可以保留，真正需要替换的是桥接层。

可保留的核心实现：

- iOS
  - `ios/ExpoSpeechRecognizer.swift`
  - `ios/SpeechRecognitionOptions.swift`
  - `ios/ExpoSpeechRecognitionException.swift`
- Android
  - `android/src/main/java/expo/modules/speechrecognition/ExpoSpeechService.kt`
  - `android/src/main/java/expo/modules/speechrecognition/ExpoAudioRecorder.kt`
  - `android/src/main/java/expo/modules/speechrecognition/DelayedFileStreamer.kt`
  - `android/src/main/java/expo/modules/speechrecognition/ExpoSpeechRecognitionOptions.kt`

结论很明确：

- 语音识别能力本身大部分可以复用
- Expo 绑定层必须全部重写

## 4. 最终架构

改造完成后的架构固定如下：

### 4.1 JS 层

使用 `react-native` 提供的标准接口：

- `NativeModules`
- `NativeEventEmitter`

JS 不再依赖：

- `expo`
- `expo-modules-core`

### 4.2 iOS 层

使用标准 RN Bridge：

- `RCTBridgeModule`
- `RCTEventEmitter`
- `RCT_EXTERN_MODULE`

不再使用：

- `ExpoModulesCore`
- `ModuleDefinition`
- Expo permissions requester

### 4.3 Android 层

使用标准 RN Native Module：

- `ReactContextBaseJavaModule`
- `ReactPackage`
- `@ReactMethod`
- RN `Promise`

不再使用：

- `expo.modules.kotlin.modules.Module`
- `ModuleDefinition`
- Expo permissions manager
- Expo Gradle plugin

### 4.4 宿主层

宿主项目手工接入原生模块：

- `askaway-ipad` 通过 CocoaPods 接入
- `Teal` 通过 Android 原生模块注册和 Manifest 配置接入

不再依赖任何 Expo 自动注入配置。

## 5. JS 层最终实现

## 5.1 模块导出

保留现有模块名语义，JS 统一导出一个标准 RN 原生模块对象。

模块对象应提供：

- `start`
- `stop`
- `abort`
- `requestPermissionsAsync`
- `getPermissionsAsync`
- `getMicrophonePermissionsAsync`
- `requestMicrophonePermissionsAsync`
- `getSpeechRecognizerPermissionsAsync`
- `requestSpeechRecognizerPermissionsAsync`
- `getStateAsync`
- `getSupportedLocales`
- `getSpeechRecognitionServices`
- `getDefaultRecognitionService`
- `getAssistantService`
- `supportsOnDeviceRecognition`
- `supportsRecording`
- `isRecognitionAvailable`
- `androidTriggerOfflineModelDownload`
- `setCategoryIOS`
- `getAudioSessionCategoryAndOptionsIOS`
- `setAudioSessionActiveIOS`
- `addListener`

结论：

- 不是只迁 `loom` 现在用到的几个 API
- 而是直接把当前原生桥接可承载的 API 全部迁到标准 RN 模块体系

## 5.2 事件系统

统一通过 `NativeEventEmitter` 实现。

事件名保持现有语义：

- `audiostart`
- `audioend`
- `end`
- `error`
- `nomatch`
- `result`
- `soundstart`
- `soundend`
- `speechstart`
- `speechend`
- `start`
- `languagedetection`
- `volumechange`

JS 层需要做的事：

1. 提供模块级 `NativeEventEmitter`
2. 提供 `addListener(eventName, listener)`
3. 将 `useSpeechRecognitionEvent` 改为基于标准 RN 事件系统的 hook

## 5.3 类型层

类型定义改为库内自定义，不再引用 Expo 类型。

需要完成的事：

1. 自定义权限返回类型
2. 自定义 Native events 类型
3. 自定义模块方法签名类型

原则：

- 保持现有 JS API 语义稳定
- 不保留任何 Expo 类型依赖

## 6. iOS 最终实现

## 6.1 桥接方式

`askaway-ipad` 当前是标准 RN Bridge 模式，依据：

- `../askaway-ipad/Podfile`

因此 iOS 最终实现固定为：

- Swift 模块类继承 `RCTEventEmitter`
- 使用 `@objc` 暴露方法
- 使用 `RCT_EXTERN_MODULE` 导出

## 6.2 方法实现

新的 iOS 模块负责把现有能力导出为 RN 原生模块方法。

需要导出的能力包括：

- 权限查询
- 权限申请
- 启动识别
- 停止识别
- 取消识别
- 状态查询
- iOS 音频会话控制
- 事件发送

## 6.3 权限实现

删除这三个 Expo 权限类的职责：

- `ios/EXSpeechRecognitionPermissionRequester.swift`
- `ios/MicrophoneRequester.swift`
- `ios/SpeechRecognizerRequester.swift`

改为由模块内部直接实现：

- 麦克风权限：`AVAudioSession.sharedInstance().requestRecordPermission`
- 语音识别权限：`SFSpeechRecognizer.requestAuthorization`

需要导出的权限相关方法全部在模块类中直接实现：

- `getPermissionsAsync`
- `requestPermissionsAsync`
- `getMicrophonePermissionsAsync`
- `requestMicrophonePermissionsAsync`
- `getSpeechRecognizerPermissionsAsync`
- `requestSpeechRecognizerPermissionsAsync`

## 6.4 事件实现

通过 `supportedEvents()` 声明所有事件，通过 `sendEvent(withName:body:)` 统一派发。

现有 `ExpoSpeechRecognizer.swift` 中向桥接层输出事件的逻辑继续保留，但事件出口改接到新的 RN emitter。

## 6.5 iOS 需要修改的文件

- `ios/ExpoSpeechRecognitionModule.swift`
- `ios/EXSpeechRecognitionPermissionRequester.swift`
- `ios/MicrophoneRequester.swift`
- `ios/SpeechRecognizerRequester.swift`
- `ios/ExpoSpeechRecognition.podspec`

其中：

- `ExpoSpeechRecognitionModule.swift` 重写
- 3 个 Expo 权限 requester 删除或并入模块实现
- `podspec` 改为普通 RN 原生库接入方式，并删除 `ExpoModulesCore` 依赖

## 7. Android 最终实现

## 7.1 桥接方式

`Teal` 现有工程支持普通 `ReactPackage` 手工注册，依据：

- `../Teal/android/app/src/main/java/com/askaway/android/core/AskAwayPackage.kt`
- `../Teal/android/app/src/main/java/com/askaway/android/MainApplication.kt`

因此 Android 最终实现固定为：

- `ReactContextBaseJavaModule`
- `ReactPackage`
- `@ReactMethod`

## 7.2 方法实现

新的 Android 模块负责导出与 iOS 对齐的全部模块方法。

包括：

- 权限查询
- 权限申请
- 启动识别
- 停止识别
- 取消识别
- 状态查询
- locale / service 查询
- on-device 能力查询
- 离线模型下载
- 事件发送

## 7.3 权限实现

删除 Expo 权限管理依赖，模块内部直接处理 `RECORD_AUDIO`。

必须实现：

- `getPermissionsAsync`
- `requestPermissionsAsync`
- `getMicrophonePermissionsAsync`
- `requestMicrophonePermissionsAsync`

Android 上 `speech recognizer` 独立权限本来就不存在，因此：

- `getSpeechRecognizerPermissionsAsync`
- `requestSpeechRecognizerPermissionsAsync`

继续返回与现有语义一致的“granted”结果，但实现方式改为标准 RN 模块内部直接返回，而不是依赖 Expo。

## 7.4 事件实现

继续复用 `ExpoSpeechService.kt` 的识别逻辑，但将事件出口改为：

- `DeviceEventManagerModule.RCTDeviceEventEmitter`

这一步是 Android 迁移的核心。

## 7.5 Android 需要修改的文件

- `android/src/main/java/expo/modules/speechrecognition/ExpoSpeechRecognitionModule.kt`
- `android/build.gradle`

以及新增或调整：

- Android `ReactPackage` 注册类

其中：

- `ExpoSpeechRecognitionModule.kt` 重写为标准 RN Native Module
- `build.gradle` 删除 Expo Modules Core 插件和相关 helper，改成普通 RN Android Library 配置

## 8. 宿主接入

## 8.1 loom

`loom` 当前已经通过一层服务封装收口语音识别能力：

- `../loom/src/askc-host/utils/SpeechRecognitionService.ts`

因此 `loom` 的改动应控制在这一层，不改业务层调用方式。

最终改动：

1. 将模块加载来源改为新的标准 RN 模块
2. 保持现有服务接口不变
3. 继续通过同样的事件语义向上层暴露能力

相关业务调用文件例如：

- `../loom/src/askc-host/features/input/AskcInputMobileView.tsx`

不需要因为这次迁移重写业务逻辑。

## 8.2 askaway-ipad

`askaway-ipad` 当前已经具备语音权限文案：

- `../askaway-ipad/Canvas/Info.plist`

已存在：

- `NSMicrophoneUsageDescription`
- `NSSpeechRecognitionUsageDescription`

因此 iOS 宿主接入动作如下：

1. 在 `Podfile` 中引入改造后的本地库
2. `pod install`
3. 确认模块成功注册到 RN Bridge
4. 联调权限、识别、事件

## 8.3 Teal

`Teal` 当前缺少语音识别所需的宿主配置。

依据：

- `../Teal/android/app/src/main/AndroidManifest.xml`

必须补齐：

### 8.3.1 权限

增加：

- `<uses-permission android:name="android.permission.RECORD_AUDIO" />`

### 8.3.2 package visibility

在 `<queries>` 中增加：

- `<intent>`
- `<action android:name="android.speech.RecognitionService" />`
- `</intent>`

如果后续需要显式访问特定识别服务包名，再补具体 `<package>`。

### 8.3.3 原生模块注册

将新的语音识别 `ReactPackage` 注册到：

- `../Teal/android/app/src/main/java/com/askaway/android/MainApplication.kt`

如果 autolink 在你们工程结构里不稳定，则直接手工注册，不依赖自动发现。

## 9. 需要处理的文件

## 9.1 当前仓库

- `src/ExpoSpeechRecognitionModule.ts`
- `src/useSpeechRecognitionEvent.ts`
- `src/ExpoSpeechRecognitionModule.types.ts`
- `src/index.ts`
- `ios/ExpoSpeechRecognitionModule.swift`
- `ios/EXSpeechRecognitionPermissionRequester.swift`
- `ios/MicrophoneRequester.swift`
- `ios/SpeechRecognizerRequester.swift`
- `ios/ExpoSpeechRecognition.podspec`
- `android/src/main/java/expo/modules/speechrecognition/ExpoSpeechRecognitionModule.kt`
- `android/build.gradle`
- `package.json`
- `tsconfig.json`

需要删除的 Expo 残留配置：

- `expo-module.config.json`
- `app.plugin.js`

## 9.2 loom

- `../loom/src/askc-host/utils/SpeechRecognitionService.ts`

## 9.3 askaway-ipad

- `../askaway-ipad/Podfile`

## 9.4 Teal

- `../Teal/android/app/src/main/AndroidManifest.xml`
- `../Teal/android/app/src/main/java/com/askaway/android/MainApplication.kt`

## 10. 实施顺序

按以下顺序实施：

1. 重写 JS 层模块加载、事件系统、类型层
2. 重写 iOS 原生桥接层
3. 重写 Android 原生桥接层
4. 清理当前仓库中的 Expo 依赖与 Expo 配置文件
5. 在 `loom` 中替换 `SpeechRecognitionService.ts` 的底层模块来源
6. 在 `askaway-ipad` 中接入并联调 iOS
7. 在 `Teal` 中补 Manifest、注册模块并联调 Android
8. 验证 `loom` 现有语音输入链路在两端宿主中可用

## 11. 实施阶段拆分

本次改造需要分两个阶段完成。

原因不是能力本身不能一次性迁移，而是桥接层、宿主接入、权限流程、事件链路同时变更，联调面较大。  
因此应先完成 Loom 宿主可用的主链路，再补齐剩余原生能力接口。

### 11.1 第一阶段：宿主可用

第一阶段目标：

- 让 `loom` 在 `askaway-ipad` 和 `Teal` 中稳定使用语音识别
- 完成 Expo 桥接层到标准 RN 桥接层的替换
- 打通权限、识别、结果回传、结束事件的完整主链路

第一阶段范围如下。

#### 当前库

需要完成：

- JS 层改为 `NativeModules` + `NativeEventEmitter`
- iOS 层改为 `RCTEventEmitter` / `RCTBridgeModule`
- Android 层改为 `ReactContextBaseJavaModule` / `ReactPackage`
- 删除 Expo Modules 相关运行时桥接
- 删除 Expo 相关构建与配置残留

第一阶段必须保证以下接口可用：

- `requestPermissionsAsync`
- `start`
- `stop`
- `abort`
- `addListener`

第一阶段必须保证以下事件可用：

- `start`
- `end`
- `result`
- `error`

#### loom

需要完成：

- 修改 `../loom/src/askc-host/utils/SpeechRecognitionService.ts`
- 保持上层业务调用不变
- 验证 `AskcInputMobileView` 现有链路可直接工作

#### askaway-ipad

需要完成：

- Pod 接入新桥接后的本地库
- 编译通过
- 权限弹窗、识别、结果事件、结束事件验证通过

#### Teal

需要完成：

- 增加 `RECORD_AUDIO`
- 增加 speech recognition `queries`
- 注册原生模块
- 编译通过
- 权限弹窗、识别、结果事件、结束事件验证通过

第一阶段验收标准：

1. 当前库已不依赖 Expo 运行时桥接
2. `loom` 不改业务调用即可发起识别
3. iOS 宿主可授权、开始识别、收到结果、正常结束
4. Android 宿主可授权、开始识别、收到结果、正常结束
5. `start/stop/abort/requestPermissionsAsync` 在双端都可用

### 11.2 第二阶段：补齐完整 API

第二阶段目标：

- 将当前库已有的原生能力完整迁移到标准 RN 模块体系
- 补齐第一阶段未纳入主链路的全部接口和事件

第二阶段范围如下。

#### 权限与状态相关

- `getPermissionsAsync`
- `getMicrophonePermissionsAsync`
- `requestMicrophonePermissionsAsync`
- `getSpeechRecognizerPermissionsAsync`
- `requestSpeechRecognizerPermissionsAsync`
- `getStateAsync`

#### Android 能力查询与模型相关

- `getSupportedLocales`
- `getSpeechRecognitionServices`
- `getDefaultRecognitionService`
- `getAssistantService`
- `supportsOnDeviceRecognition`
- `supportsRecording`
- `isRecognitionAvailable`
- `androidTriggerOfflineModelDownload`

#### iOS 音频会话相关

- `setCategoryIOS`
- `getAudioSessionCategoryAndOptionsIOS`
- `setAudioSessionActiveIOS`

#### 事件与增强能力

- `audiostart`
- `audioend`
- `nomatch`
- `soundstart`
- `soundend`
- `speechstart`
- `speechend`
- `languagedetection`
- `volumechange`

#### 文件与录音相关

- 音频文件转写
- 录音持久化

第二阶段验收标准：

1. 当前库公开的原生能力接口全部迁移完成
2. 当前库现有原生事件全部迁移完成
3. iOS 与 Android 的能力差异仍保持当前语义
4. `loom` 在不引入 Expo 的前提下可继续扩展后续语音能力

## 12. 最终结果要求

改造完成后，应满足以下条件：

1. 当前库不再依赖 `expo` 或 `expo-modules-core`
2. 当前库不再包含 Expo Module 桥接实现
3. `loom` 可通过标准 RN 原生模块调用语音识别
4. `askaway-ipad` 可正常编译、授权、识别、收事件
5. `Teal` 可正常编译、授权、识别、收事件
6. 不保留任何面向 Expo 宿主的兼容逻辑

## 13. 一句话总结

最终方案就是：  
**保留现有语音识别核心，删除全部 Expo 桥接层，重建一套纯 React Native 原生模块桥接，并只为 `loom`、`askaway-ipad`、`Teal` 这三个工程提供能力。**
