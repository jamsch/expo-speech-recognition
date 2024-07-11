package expo.modules.speechrecognition

import android.annotation.SuppressLint
import android.content.Context
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.ParcelFileDescriptor
import android.os.ParcelFileDescriptor.AutoCloseOutputStream
import java.io.File
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

    val outputFile: File? = null

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
                    writeAudioDataToFile()
                }
        }
    }

    override fun stop() {
        isRecordingAudio = false
        audioRecorder?.stop()
        audioRecorder?.release()
        audioRecorder = null
        recordingThread = null
        writeWavHeaders()
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

    private fun writeAudioDataToFile() {
        val data = ByteArray(bufferSizeInBytes / 2)
        /*
        val outputStream: FileOutputStream?
        try {
            outputStream = tempPcmFile.outputStream()
        } catch (e: FileNotFoundException) {
            return
        }
         */
        while (isRecordingAudio) {
            val read = audioRecorder!!.read(data, 0, data.size)

            //    if (mOutputStream != null) {
            //        mOutputStream.write(readBytes, 0, readBytes.length);
            //        mOutputStream.flush();
            //    }

            try {
                outputStream?.write(data, 0, read)
                outputStream?.flush()
                // clean up file writing operations
            } catch (e: IOException) {
                e.printStackTrace()
            }
        }
//        try {
//            outputStream?.flush()
//            outputStream?.close()
//        } catch (e: IOException) {
//            Log.e("ExpoSpeechService", "exception while closing output stream $e")
//            e.printStackTrace()
//        }
    }

    private fun writeWavHeaders() {
        val wavHeaderSize = 44
        val totalAudioLen = tempPcmFile.length()
        val totalDataLen = totalAudioLen + wavHeaderSize - 8
        val byteRate = sampleRateInHz * 16 / 8

        val header = ByteArray(wavHeaderSize)
        header[0] = 'R'.code.toByte()
        header[1] = 'I'.code.toByte()
        header[2] = 'F'.code.toByte()
        header[3] = 'F'.code.toByte()
        header[4] = (totalDataLen and 0xff).toByte()
        header[5] = ((totalDataLen shr 8) and 0xff).toByte()
        header[6] = ((totalDataLen shr 16) and 0xff).toByte()
        header[7] = ((totalDataLen shr 24) and 0xff).toByte()
        header[8] = 'W'.code.toByte()
        header[9] = 'A'.code.toByte()
        header[10] = 'V'.code.toByte()
        header[11] = 'E'.code.toByte()
        header[12] = 'f'.code.toByte()
        header[13] = 'm'.code.toByte()
        header[14] = 't'.code.toByte()
        header[15] = ' '.code.toByte()
        header[16] = 16 // Sub chunk size, 16 for PCM
        header[17] = 0
        header[18] = 1 // Audio format, 1 for PCM
        header[19] = 0
        header[20] = 1 // Number of channels, 1 for mono
        header[21] = 0
        header[22] = (sampleRateInHz and 0xff).toByte()
        header[23] = ((sampleRateInHz shr 8) and 0xff).toByte()
        header[24] = ((sampleRateInHz shr 16) and 0xff).toByte()
        header[25] = ((sampleRateInHz shr 24) and 0xff).toByte()
        header[26] = (byteRate and 0xff).toByte()
        header[27] = ((byteRate shr 8) and 0xff).toByte()
        header[28] = ((byteRate shr 16) and 0xff).toByte()
        header[29] = ((byteRate shr 24) and 0xff).toByte()
        header[30] = (2).toByte() // Block align
        header[31] = 0
        header[32] = 16 // Bits per sample
        header[33] = 0
        header[34] = 'd'.code.toByte()
        header[35] = 'a'.code.toByte()
        header[36] = 't'.code.toByte()
        header[37] = 'a'.code.toByte()
        header[38] = (totalAudioLen and 0xff).toByte()
        header[39] = ((totalAudioLen shr 8) and 0xff).toByte()
        header[40] = ((totalAudioLen shr 16) and 0xff).toByte()
        header[41] = ((totalAudioLen shr 24) and 0xff).toByte()

        try {
            val pcmData = tempPcmFile.readBytes()
            val wavFile = File(outputFilePath)
            wavFile.writeBytes(header + pcmData)
            tempPcmFile.delete()
        } catch (e: IOException) {
            e.printStackTrace()
        }
    }
}
