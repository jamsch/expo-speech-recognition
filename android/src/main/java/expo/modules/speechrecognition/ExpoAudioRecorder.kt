package expo.modules.speechrecognition

import android.annotation.SuppressLint
import android.content.Context
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.ParcelFileDescriptor
import android.os.ParcelFileDescriptor.AutoCloseOutputStream
import android.util.Log
import java.io.DataOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.UUID
import kotlin.concurrent.thread

interface AudioRecorder {
    fun start()

    fun stop()
}

/**
 * ExpoAudioRecorder allows us to record to a 16hz pcm stream for use in SpeechRecognition
 *
 * Once stopped, the recording stream is written to a wav file for external use
 */
class ExpoAudioRecorder(
    private val context: Context,
    private val outputFilePath: String,
) : AudioRecorder {
    private var audioRecorder: AudioRecord? = null

    var outputFile: File? = null

    /** The file where the mic stream is being output to */
    private val tempPcmFile: File
    val recordingParcel: ParcelFileDescriptor
    private var outputStream: AutoCloseOutputStream?

    init {
        tempPcmFile = createTempPcmFile()
        try {
            val pipe = ParcelFileDescriptor.createPipe()
            recordingParcel = pipe[0]
            outputStream = AutoCloseOutputStream(pipe[1])
        } catch (e: IOException) {
            e.printStackTrace()
            throw e
        }
    }

    val sampleRateInHz = 16000
    private val channelConfig = AudioFormat.CHANNEL_IN_MONO
    val audioFormat = AudioFormat.ENCODING_PCM_16BIT
    private val bufferSizeInBytes = AudioRecord.getMinBufferSize(sampleRateInHz, channelConfig, audioFormat)

    private var recordingThread: Thread? = null
    private var isRecordingAudio = false

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
            MediaRecorder.AudioSource.DEFAULT,
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

    override fun stop() {
        isRecordingAudio = false
        audioRecorder?.stop()
        audioRecorder?.release()
        audioRecorder = null
        recordingThread = null

        outputFile =
            appendWavHeader(
                outputFilePath,
                tempPcmFile,
            )
        // Close the ParcelFileDescriptor
        try {
            recordingParcel.close()
        } catch (e: IOException) {
            e.printStackTrace()
        }
        // And the output stream
        try {
            outputStream?.close()
            outputStream = null
        } catch (e: IOException) {
            e.printStackTrace()
        }
    }

    private fun streamAudioToPipe() {
        val tempFileOutputStream = FileOutputStream(tempPcmFile)
        val data = ByteArray(bufferSizeInBytes / 2)
        while (isRecordingAudio) {
            val read = audioRecorder!!.read(data, 0, data.size)
            try {
                outputStream?.write(data, 0, read)
                outputStream?.flush()

                // Write to the temp PCM file
                tempFileOutputStream.write(data, 0, read)
                tempFileOutputStream.flush()
            } catch (e: IOException) {
                e.printStackTrace()
            }
        }
        tempFileOutputStream.close()
    }

    private fun appendWavHeader(
        outputFilePath: String,
        audioData: File,
    ): File {
        val outputFile = File(outputFilePath)
        val audioDataLength = audioData.length()
        val sampleRate = sampleRateInHz
        val numChannels = 1
        val bitsPerSample = 16

        DataOutputStream(FileOutputStream(outputFile)).use { out ->
            val totalDataLen = 36 + audioDataLength
            val byteRate = sampleRate * numChannels * bitsPerSample / 8
            val blockAlign = numChannels * bitsPerSample / 8

            // Write the RIFF chunk descriptor
            out.writeBytes("RIFF") // ChunkID
            out.writeInt(Integer.reverseBytes(totalDataLen.toInt())) // ChunkSize
            out.writeBytes("WAVE")
            out.writeBytes("fmt ")
            out.writeInt(Integer.reverseBytes(16)) // Subchunk1Size (16 for PCM)
            out.writeShort(shortReverseBytes(1)) // AudioFormat (1 for PCM)
            out.writeShort(shortReverseBytes(numChannels.toShort())) // NumChannels
            out.writeInt(Integer.reverseBytes(sampleRate)) // SampleRate
            out.writeInt(Integer.reverseBytes(byteRate)) // ByteRate
            out.writeShort(shortReverseBytes(blockAlign.toShort())) // BlockAlign
            out.writeShort(shortReverseBytes(bitsPerSample.toShort())) // BitsPerSample

            // Write the data sub-chunk
            out.writeBytes("data")
            out.writeInt(Integer.reverseBytes(audioDataLength.toInt()))

            try {
                val pcmData = tempPcmFile.readBytes()
                out.write(pcmData)
                tempPcmFile.delete()
            } catch (e: IOException) {
                e.localizedMessage?.let { Log.d("ExpoSpeechService", it) }
                e.printStackTrace()
            }
        }

        return outputFile
    }

    private fun shortReverseBytes(s: Short): Int =
        java.lang.Short
            .reverseBytes(s)
            .toInt()
}