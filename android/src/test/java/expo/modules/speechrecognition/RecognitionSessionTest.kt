package expo.modules.speechrecognition

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Test

class RecognitionSessionTest {
    private class TestSession(
        stopMode: RecognitionStopMode,
    ) {
        val handledEffects = mutableListOf<RecognitionSessionEffect>()
        private var completeAudioStop: ((String?) -> Unit)? = null
        val session =
            RecognitionSession(stopMode) { effect, onAudioStopped ->
                handledEffects += effect
                if (effect == RecognitionSessionEffect.StopAudioInput) {
                    completeAudioStop = onAudioStopped
                }
            }

        fun completeAudioStop(uri: String?) {
            val completion = checkNotNull(completeAudioStop)
            completeAudioStop = null
            completion(uri)
        }
    }

    @Test
    fun `stop closes a segmented audio source instead of stopping the recognizer`() {
        val testSession = TestSession(RecognitionStopMode.AUDIO_SOURCE_EOF)
        val session = testSession.session

        session.onAudioStarted()
        session.requestStop()
        assertEquals(
            listOf(
                RecognitionSessionEffect.StopAudioInput,
                RecognitionSessionEffect.AwaitTerminalCallback,
            ),
            testSession.handledEffects,
        )
    }

    @Test
    fun `stop stops the recognizer when the audio source does not own the session`() {
        val testSession = TestSession(RecognitionStopMode.SPEECH_RECOGNIZER)
        val session = testSession.session

        session.onAudioStarted()
        session.requestStop()
        assertEquals(
            listOf(
                RecognitionSessionEffect.StopListening,
                RecognitionSessionEffect.AwaitTerminalCallback,
            ),
            testSession.handledEffects,
        )
    }

    @Test
    fun `a repeated stop request is ignored`() {
        val testSession = TestSession(RecognitionStopMode.SPEECH_RECOGNIZER)
        val session = testSession.session

        session.onAudioStarted()
        session.requestStop()
        session.requestStop()
        assertEquals(2, testSession.handledEffects.size)
    }

    @Test
    fun `a terminal callback arriving before the audio drains ends the session once it has`() {
        val testSession = TestSession(RecognitionStopMode.AUDIO_SOURCE_EOF)
        val session = testSession.session

        session.onAudioStarted()
        session.requestStop()
        session.finish()
        assertEquals(2, testSession.handledEffects.size)

        testSession.completeAudioStop("file://recording.wav")
        assertEquals(
            listOf(
                RecognitionSessionEffect.StopAudioInput,
                RecognitionSessionEffect.AwaitTerminalCallback,
                RecognitionSessionEffect.ReleaseRecognizer,
                RecognitionSessionEffect.EmitAudioEnd("file://recording.wav"),
                RecognitionSessionEffect.EmitEnd(RecognitionState.INACTIVE),
            ),
            testSession.handledEffects,
        )
    }

    @Test
    fun `a session whose audio drains first stays open until its terminal callback`() {
        val testSession = TestSession(RecognitionStopMode.AUDIO_SOURCE_EOF)
        val session = testSession.session

        session.onAudioStarted()
        session.requestStop()
        testSession.completeAudioStop("file://recording.wav")
        assertEquals(2, testSession.handledEffects.size)

        session.finish()
        assertEquals(
            listOf(
                RecognitionSessionEffect.StopAudioInput,
                RecognitionSessionEffect.AwaitTerminalCallback,
                RecognitionSessionEffect.ReleaseRecognizer,
                RecognitionSessionEffect.EmitAudioEnd("file://recording.wav"),
                RecognitionSessionEffect.EmitEnd(RecognitionState.INACTIVE),
            ),
            testSession.handledEffects,
        )
    }

    @Test
    fun `finishing drains audio before releasing the recognizer and ending`() {
        val testSession = TestSession(RecognitionStopMode.SPEECH_RECOGNIZER)
        val session = testSession.session

        session.onAudioStarted()
        session.finish(RecognitionState.ERROR)
        assertEquals(listOf(RecognitionSessionEffect.StopAudioInput), testSession.handledEffects)

        testSession.completeAudioStop(null)
        assertEquals(
            listOf(
                RecognitionSessionEffect.StopAudioInput,
                RecognitionSessionEffect.ReleaseRecognizer,
                RecognitionSessionEffect.EmitAudioEnd(null),
                RecognitionSessionEffect.EmitEnd(RecognitionState.ERROR),
            ),
            testSession.handledEffects,
        )

        session.finish()
        assertEquals(4, testSession.handledEffects.size)
    }

    @Test
    fun `abort rejects final callbacks and releases the recognizer before draining audio`() {
        val testSession = TestSession(RecognitionStopMode.AUDIO_SOURCE_EOF)
        val session = testSession.session

        session.onAudioStarted()
        session.abort()
        assertFalse(session.acceptsRecognizerCallbacks())
        assertEquals(
            listOf(
                RecognitionSessionEffect.ReleaseRecognizer,
                RecognitionSessionEffect.StopAudioInput,
            ),
            testSession.handledEffects,
        )

        session.finish()
        assertEquals(2, testSession.handledEffects.size)

        testSession.completeAudioStop("file://recording.wav")
        assertEquals(
            listOf(
                RecognitionSessionEffect.ReleaseRecognizer,
                RecognitionSessionEffect.StopAudioInput,
                RecognitionSessionEffect.EmitAudioEnd("file://recording.wav"),
                RecognitionSessionEffect.EmitEnd(RecognitionState.INACTIVE),
            ),
            testSession.handledEffects,
        )
    }

    @Test
    fun `start failure closes the audio input without emitting audioend`() {
        val testSession = TestSession(RecognitionStopMode.AUDIO_SOURCE_EOF)
        val session = testSession.session

        session.finish()
        assertEquals(listOf(RecognitionSessionEffect.StopAudioInput), testSession.handledEffects)

        testSession.completeAudioStop(null)
        assertEquals(
            listOf(
                RecognitionSessionEffect.StopAudioInput,
                RecognitionSessionEffect.ReleaseRecognizer,
                RecognitionSessionEffect.EmitEnd(RecognitionState.INACTIVE),
            ),
            testSession.handledEffects,
        )
    }
}
