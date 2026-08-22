package expo.modules.speechrecognition

import android.annotation.SuppressLint
import android.content.Context
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.ParcelFileDescriptor
import android.os.ParcelFileDescriptor.AutoCloseOutputStream
import android.os.Build
import android.util.Log
import androidx.annotation.RequiresApi
import java.io.DataOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.UUID
import kotlin.concurrent.thread

interface AudioRecorder {
    fun start()

    fun stop(onStopped: () -> Unit = {})
}

internal fun awaitRecordingThreadShutdown(
    worker: Thread?,
    gracefulTimeoutMillis: Long,
    forcedTimeoutMillis: Long,
    forceUnblock: () -> Unit,
): Boolean {
    if (worker == null) {
        forceUnblock()
        return true
    }

    var interrupted = false

    fun joinFor(timeoutMillis: Long): Boolean {
        try {
            worker.join(timeoutMillis)
        } catch (_: InterruptedException) {
            interrupted = true
        }
        return !worker.isAlive
    }

    try {
        if (joinFor(gracefulTimeoutMillis)) {
            return true
        }
        try {
            forceUnblock()
        } finally {
            worker.interrupt()
        }
        return joinFor(forcedTimeoutMillis)
    } finally {
        if (interrupted) {
            Thread.currentThread().interrupt()
        }
    }
}

/**
 * ExpoAudioRecorder allows us to record to a 16hz pcm stream for use in SpeechRecognition
 *
 * Once stopped, the recording stream is written to a wav file for external use
 */
@RequiresApi(Build.VERSION_CODES.GINGERBREAD)
class ExpoAudioRecorder(
    private val context: Context,
    // Optional output file path
    private val outputFilePath: String?,
) : AudioRecorder {
    private var audioRecorder: AudioRecord? = null

    var outputFile: File? = null
    var outputFileUri = "file://$outputFilePath"

    /** The file where the mic stream is being output to */
    private val tempPcmFile: File
    val recordingParcel: ParcelFileDescriptor

    @Volatile
    private var outputStream: AutoCloseOutputStream?

    init {
        tempPcmFile = createTempPcmFile()
        try {
            val pipe = ParcelFileDescriptor.createPipe()
            recordingParcel = pipe[0]
            outputStream = AutoCloseOutputStream(pipe[1])
        } catch (e: IOException) {
            Log.e(TAG, "Failed to create pipe", e)
            e.printStackTrace()
            throw e
        }
    }

    val sampleRateInHz = 16000
    private val channelConfig = AudioFormat.CHANNEL_IN_MONO
    val audioFormat = AudioFormat.ENCODING_PCM_16BIT
    private val bufferSizeInBytes = AudioRecord.getMinBufferSize(sampleRateInHz, channelConfig, audioFormat)

    private var recordingThread: Thread? = null

    @Volatile
    private var isRecordingAudio = false

    companion object {
        private const val TAG = "ExpoAudioRecorder"
        private const val GRACEFUL_DRAIN_TIMEOUT_MS = 2_000L
        private const val FORCED_DRAIN_TIMEOUT_MS = 250L

        private fun shortReverseBytes(s: Short): Int =
            java.lang.Short
                .reverseBytes(s)
                .toInt()

        fun appendWavHeader(
            outputFilePath: String,
            pcmFile: File,
            sampleRateInHz: Int,
        ): File {
            val outputFile = File(outputFilePath)
            val audioDataLength = pcmFile.length()
            val numChannels = 1
            val bitsPerSample = 16

            DataOutputStream(FileOutputStream(outputFile)).use { out ->
                val totalDataLen = 36 + audioDataLength
                val byteRate = sampleRateInHz * numChannels * bitsPerSample / 8
                val blockAlign = numChannels * bitsPerSample / 8

                // Write the RIFF chunk descriptor
                out.writeBytes("RIFF") // ChunkID
                out.writeInt(Integer.reverseBytes(totalDataLen.toInt())) // ChunkSize
                out.writeBytes("WAVE")
                out.writeBytes("fmt ")
                out.writeInt(Integer.reverseBytes(16)) // Subchunk1Size (16 for PCM)
                out.writeShort(shortReverseBytes(1)) // AudioFormat (1 for PCM)
                out.writeShort(shortReverseBytes(numChannels.toShort())) // NumChannels
                out.writeInt(Integer.reverseBytes(sampleRateInHz)) // SampleRate
                out.writeInt(Integer.reverseBytes(byteRate)) // ByteRate
                out.writeShort(shortReverseBytes(blockAlign.toShort())) // BlockAlign
                out.writeShort(shortReverseBytes(bitsPerSample.toShort())) // BitsPerSample

                // Write the data sub-chunk
                out.writeBytes("data")
                out.writeInt(Integer.reverseBytes(audioDataLength.toInt()))

                try {
                    val pcmData = pcmFile.readBytes()
                    out.write(pcmData)
                    pcmFile.delete()
                } catch (e: IOException) {
                    Log.e(TAG, "Failed to read PCM file", e)
                    e.printStackTrace()
                }
            }

            return outputFile
        }
    }

    private fun createTempPcmFile(): File {
        val file = File(context.cacheDir, "temp_${UUID.randomUUID()}.pcm")
        if (!file.exists()) {
            try {
                file.createNewFile()
            } catch (e: IOException) {
                e.printStackTrace()
            }
        }
        return file
    }

    @SuppressLint("MissingPermission")
    private fun createRecorder(): AudioRecord =
        AudioRecord(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            sampleRateInHz,
            channelConfig,
            AudioFormat.ENCODING_PCM_16BIT,
            bufferSizeInBytes,
        )

    override fun start() {
        createRecorder().apply {
            audioRecorder = this

            // First check whether the above object actually initialized
            if (this.state != AudioRecord.STATE_INITIALIZED) {
                return
            }

            this.startRecording()
            isRecordingAudio = true

            // Start thread
            recordingThread =
                thread {
                    streamAudioToPipe()
                }
        }
    }

    override fun stop(onStopped: () -> Unit) {
        isRecordingAudio = false
        // Signal AudioRecord before returning so a replacement start cannot capture concurrently.
        // Draining and releasing it happen off the main thread below.
        try {
            audioRecorder?.stop()
        } catch (e: IllegalStateException) {
            Log.w(TAG, "AudioRecord was not recording when stop was requested", e)
        }
        thread(name = "ExpoSpeechAudioStop") {
            try {
                val drained =
                    awaitRecordingThreadShutdown(
                        recordingThread,
                        gracefulTimeoutMillis = GRACEFUL_DRAIN_TIMEOUT_MS,
                        forcedTimeoutMillis = FORCED_DRAIN_TIMEOUT_MS,
                        forceUnblock = ::closeOutputStream,
                    )
                recordingThread = null

                try {
                    audioRecorder?.release()
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to release AudioRecord", e)
                } finally {
                    audioRecorder = null
                }

                // The recognizer received its own dup through the intent, so our copy of the
                // read end is no longer needed.
                try {
                    recordingParcel.close()
                } catch (e: IOException) {
                    Log.e(TAG, "Failed to close the recording descriptor", e)
                }

                if (outputFilePath != null && drained) {
                    try {
                        outputFile =
                            appendWavHeader(
                                outputFilePath,
                                tempPcmFile,
                                sampleRateInHz,
                            )
                    } catch (e: IOException) {
                        Log.e(TAG, "Failed to append WAV header", e)
                    }
                } else if (!drained) {
                    Log.e(TAG, "Recording worker did not stop; skipping WAV finalization")
                }
            } finally {
                onStopped()
            }
        }
    }

    @Synchronized
    private fun closeOutputStream() {
        try {
            outputStream?.close()
        } catch (e: IOException) {
            Log.e(TAG, "Failed to close the recognizer audio stream", e)
        } finally {
            outputStream = null
        }
    }

    private fun streamAudioToPipe() {
        val data = ByteArray(bufferSizeInBytes)

        try {
            FileOutputStream(tempPcmFile).use { tempFileOutputStream ->
                while (isRecordingAudio) {
                    val recorder = audioRecorder ?: break

                    val read =
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            // avoid empty reads
                            recorder.read(data, 0, data.size, AudioRecord.READ_BLOCKING)
                        } else {
                            recorder.read(data, 0, data.size)
                        }

                    when {
                        read > 0 -> {
                            // Persist first so a recognizer pipe failure cannot discard the tail.
                            if (outputFilePath != null) {
                                tempFileOutputStream.write(data, 0, read)
                                tempFileOutputStream.flush()
                            }

                            try {
                                outputStream?.write(data, 0, read)
                                outputStream?.flush()
                            } catch (e: IOException) {
                                Log.e(TAG, "Failed to write to recognizer audio stream", e)
                                break
                            }
                        }

                        // (this should only happen on API 22 and below)
                        read == 0 -> {
                            try {
                                Thread.sleep(10)
                            } catch (_: InterruptedException) {}
                        }

                        read == AudioRecord.ERROR_DEAD_OBJECT -> {
                            Log.w(TAG, "AudioRecord returned ERROR_DEAD_OBJECT; breaking out of the loop")
                            // todo: we should probably emit an error event here
                            break
                        }

                        read == AudioRecord.ERROR_INVALID_OPERATION || read == AudioRecord.ERROR_BAD_VALUE -> {
                            Log.w(TAG, "AudioRecord read error: $read; backing off briefly")
                            try {
                                Thread.sleep(10)
                            } catch (_: InterruptedException) {}
                        }

                        else -> {
                            // todo: we should probably emit an error event here
                            Log.w(TAG, "AudioRecord read returned '$read'; breaking out of the loop")
                            break
                        }
                    }
                }
            }
        } catch (e: IOException) {
            Log.e(TAG, "Failed to persist recorded audio", e)
        } finally {
            // Only the worker closes the writer, so the recognizer's EOF always follows the
            // last write.
            closeOutputStream()
        }
    }
}
