package expo.modules.speechrecognition

import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir

class AppendWavHeaderTest {
    @TempDir
    lateinit var tempDir: File

    @Test
    fun `writes a 16-bit mono PCM header followed by the recorded samples`() {
        val samples = ByteArray(3_200) { (it % 256).toByte() }
        val pcmFile = File(tempDir, "recording.pcm").apply { writeBytes(samples) }
        val outputPath = File(tempDir, "recording.wav").absolutePath

        val wavFile = ExpoAudioRecorder.appendWavHeader(outputPath, pcmFile, 16_000)

        val bytes = wavFile.readBytes()
        val header = ByteBuffer.wrap(bytes, 0, 44).order(ByteOrder.LITTLE_ENDIAN)
        assertEquals("RIFF", String(bytes, 0, 4))
        assertEquals(36 + samples.size, header.getInt(4))
        assertEquals("WAVE", String(bytes, 8, 4))
        assertEquals("fmt ", String(bytes, 12, 4))
        assertEquals(16, header.getInt(16))
        assertEquals(1, header.getShort(20).toInt())
        assertEquals(1, header.getShort(22).toInt())
        assertEquals(16_000, header.getInt(24))
        assertEquals(32_000, header.getInt(28))
        assertEquals(2, header.getShort(32).toInt())
        assertEquals(16, header.getShort(34).toInt())
        assertEquals("data", String(bytes, 36, 4))
        assertEquals(samples.size, header.getInt(40))
        assertArrayEquals(samples, bytes.copyOfRange(44, bytes.size))
        assertFalse(pcmFile.exists())
    }
}
