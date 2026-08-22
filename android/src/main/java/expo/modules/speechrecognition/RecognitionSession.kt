package expo.modules.speechrecognition

internal enum class RecognitionStopMode {
    SPEECH_RECOGNIZER,
    AUDIO_SOURCE_EOF,
}

internal sealed interface RecognitionSessionEffect {
    data object StopAudioInput : RecognitionSessionEffect

    data object StopListening : RecognitionSessionEffect

    data object ReleaseRecognizer : RecognitionSessionEffect

    /**
     * A stop was requested and the recognizer still owes a terminal callback. Handlers must
     * eventually call [RecognitionSession.finish] so the session cannot wait forever.
     */
    data object AwaitTerminalCallback : RecognitionSessionEffect

    data class EmitAudioEnd(
        val uri: String?,
    ) : RecognitionSessionEffect

    data class EmitEnd(
        val state: RecognitionState,
    ) : RecognitionSessionEffect
}

internal fun interface RecognitionSessionEffectHandler {
    fun handle(
        effect: RecognitionSessionEffect,
        onAudioStopped: (String?) -> Unit,
    )
}

/**
 * Owns the lifecycle and event ordering for one recognition session.
 *
 * Android callbacks can outlive their recognizer, so callers must also use object identity to
 * discard effects from sessions that are no longer current.
 */
internal class RecognitionSession(
    private val stopMode: RecognitionStopMode,
    private val effectHandler: RecognitionSessionEffectHandler,
) {
    private sealed interface Phase {
        data object Running : Phase

        data object StopRequested : Phase

        data class Finishing(
            val state: RecognitionState,
            val recognizerReleased: Boolean,
        ) : Phase

        data object Finished : Phase
    }

    private sealed interface Audio {
        data object Open : Audio

        data object Stopping : Audio

        data class Stopped(
            val uri: String?,
        ) : Audio
    }

    private var phase: Phase = Phase.Running
    private var audio: Audio = Audio.Open

    /** Whether "audiostart" was announced, and so whether an "audioend" is owed. */
    private var didStartCapturing = false
    private var isActive = true

    fun onAudioStarted() {
        if (isActive) {
            didStartCapturing = true
        }
    }

    fun requestStop() {
        if (isActive) {
            apply(requestStopEffects())
        }
    }

    fun finish(state: RecognitionState = RecognitionState.INACTIVE) {
        if (isActive) {
            apply(finishEffects(state))
        }
    }

    fun abort(state: RecognitionState = RecognitionState.INACTIVE) {
        if (isActive) {
            apply(finishEffects(state, releaseRecognizerImmediately = true))
        }
    }

    fun acceptsRecognizerCallbacks(): Boolean =
        isActive && phase !is Phase.Finishing && phase != Phase.Finished

    fun deactivate() {
        isActive = false
    }

    private fun requestStopEffects(): List<RecognitionSessionEffect> {
        if (phase != Phase.Running) {
            return emptyList()
        }
        phase = Phase.StopRequested
        return buildList {
            when (stopMode) {
                RecognitionStopMode.SPEECH_RECOGNIZER -> add(RecognitionSessionEffect.StopListening)
                RecognitionStopMode.AUDIO_SOURCE_EOF -> addAll(beginStoppingAudio())
            }
            add(RecognitionSessionEffect.AwaitTerminalCallback)
        }
    }

    private fun onAudioStopped(uri: String?): List<RecognitionSessionEffect> {
        if (audio is Audio.Stopped) {
            return emptyList()
        }
        audio = Audio.Stopped(uri)
        return when (phase) {
            is Phase.Finishing -> finishAfterAudioStops(uri)
            else -> emptyList()
        }
    }

    private fun finishEffects(
        state: RecognitionState,
        releaseRecognizerImmediately: Boolean = false,
    ): List<RecognitionSessionEffect> {
        if (phase is Phase.Finishing || phase == Phase.Finished) {
            return emptyList()
        }
        phase = Phase.Finishing(state, recognizerReleased = releaseRecognizerImmediately)
        return buildList {
            if (releaseRecognizerImmediately) {
                add(RecognitionSessionEffect.ReleaseRecognizer)
            }
            when (val current = audio) {
                Audio.Open -> addAll(beginStoppingAudio())
                Audio.Stopping -> Unit
                is Audio.Stopped -> addAll(finishAfterAudioStops(current.uri))
            }
        }
    }

    private fun beginStoppingAudio(): List<RecognitionSessionEffect> {
        if (audio != Audio.Open) {
            return emptyList()
        }
        audio = Audio.Stopping
        return listOf(RecognitionSessionEffect.StopAudioInput)
    }

    private fun apply(effects: List<RecognitionSessionEffect>) {
        effects.forEach { effect ->
            if (!isActive) {
                return
            }
            effectHandler.handle(effect) { uri ->
                if (isActive) {
                    apply(onAudioStopped(uri))
                }
            }
            if (effect is RecognitionSessionEffect.EmitEnd) {
                isActive = false
            }
        }
    }

    private fun finishAfterAudioStops(uri: String?): List<RecognitionSessionEffect> {
        val finishing = phase as? Phase.Finishing ?: return emptyList()
        phase = Phase.Finished
        return buildList {
            if (!finishing.recognizerReleased) {
                add(RecognitionSessionEffect.ReleaseRecognizer)
            }
            if (didStartCapturing) {
                add(RecognitionSessionEffect.EmitAudioEnd(uri))
            }
            add(RecognitionSessionEffect.EmitEnd(finishing.state))
        }
    }
}
