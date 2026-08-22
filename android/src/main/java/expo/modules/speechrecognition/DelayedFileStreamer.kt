package expo.modules.speechrecognition

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.os.ParcelFileDescriptor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File
import java.io.IOException
import java.io.OutputStream

/**
* This class is used to stream audio to the speech recognition service
*
* It adds an artifical delay between chunks of audio to simulate a real-time stream
*
* Important Note: if you're using network-based streaming,
* you may want to consider lengthening the delay to avoid any rate-limiting or other network issues
*/
class DelayedFileStreamer {
    private var audioFile: File
    private var pfd: ParcelFileDescriptor
    private var sink: ParcelFileDescriptor.AutoCloseOutputStream
    private var delayMillis: Long // Delay between the 4KB chunks

    constructor(file: File, delayMillis: Long = 100L) {
        audioFile = file
        this.delayMillis = delayMillis
        val pipe = ParcelFileDescriptor.createPipe()
        val source = ParcelFileDescriptor.AutoCloseInputStream(pipe[0])
        sink = ParcelFileDescriptor.AutoCloseOutputStream(pipe[1])
        pfd = ParcelFileDescriptor.dup(source.fd)
    }

    fun getParcel(): ParcelFileDescriptor = pfd

    fun startStreaming() {
        CoroutineScope(Dispatchers.IO).launch {
            streamAudioContents(audioFile, sink)
        }
    }

    /*
    // This works well with simple raw audio files
    private suspend fun writeFileToStream(
        file: File,
        outputStream: OutputStream,
    ) {
        val buffer = ByteArray(1024 * 4) // 4KB
        var bytesRead: Int

        FileInputStream(file).use { fis ->
            try {
                while (fis.read(buffer).also { bytesRead = it } > 0) {
                    delay(delayMillis)
                    outputStream.write(buffer, 0, bytesRead)
                }
            } catch (e: IOException) {
                e.printStackTrace()
            } finally {
                try {
                    outputStream.close()
                } catch (e: IOException) {
                    e.printStackTrace()
                }
            }
        }
    }
     */

    private suspend fun streamAudioContents(
        file: File,
        outputStream: OutputStream,
    ) {
        // val cacheFile = File(file.parentFile, "cached_audio.pcm")
        // var cacheOutputStream: FileOutputStream? = null

        try {
            // cacheOutputStream = FileOutputStream(cacheFile)
            val extractor = MediaExtractor()
            extractor.setDataSource(file.absolutePath)
            val format = extractor.getTrackFormat(0)
            val mime = format.getString(MediaFormat.KEY_MIME) ?: return
            if (!mime.startsWith("audio/")) throw IllegalArgumentException("Not an audio file")

            extractor.selectTrack(0)

            val codec = MediaCodec.createDecoderByType(mime)
            codec.configure(format, null, null, 0)
            codec.start()
            val bufferInfo = MediaCodec.BufferInfo()

            while (true) {
                val inputBufferIndex = codec.dequeueInputBuffer(10000)
                if (inputBufferIndex >= 0) {
                    val inputBuffer = codec.getInputBuffer(inputBufferIndex)
                    if (inputBuffer != null) {
                        inputBuffer.clear()
                        val sampleSize = extractor.readSampleData(inputBuffer, 0)
                        if (sampleSize < 0) {
                            codec.queueInputBuffer(
                                inputBufferIndex,
                                0,
                                0,
                                0L,
                                MediaCodec.BUFFER_FLAG_END_OF_STREAM,
                            )
                        } else {
                            codec.queueInputBuffer(
                                inputBufferIndex,
                                0,
                                sampleSize,
                                extractor.sampleTime,
                                0,
                            )
                            extractor.advance()
                        }
                    }
                }

                val outputBufferIndex = codec.dequeueOutputBuffer(bufferInfo, 10000)
                if (outputBufferIndex >= 0) {
                    val outputBuffer = codec.getOutputBuffer(outputBufferIndex)
                    if (outputBuffer != null) {
                        val chunk = ByteArray(bufferInfo.size)

                        outputBuffer.get(chunk)
                        outputBuffer.clear()
                        if (chunk.isNotEmpty()) {
                            // Add an artificial delay between the chunks of audio
                            // As we're not playing-back the audio we're just delaying the output stream
                            // so the speech recognizer has some time to process the audio
                            // Especially important for network-based recognition (and potentially avoiding rate-limiting)
                            val delayMs = (chunk.size / 4192.0) * delayMillis
                            delay(delayMs.toLong())
                            try {
                                // Log.d(
                                //     "ExpoSpeechService",
                                //     "output write, size=" + chunk.size + ", delay=" + delayMs.toLong() + "ms with base delay of " +
                                //         delayMillis,
                                // )
                                outputStream.write(chunk)
                                // outputStream.flush()
                                // cacheOutputStream?.write(chunk)
                                // cacheOutputStream?.flush()
                            } catch (e: IOException) {
                                e.printStackTrace()
                            }
                        }
                    }
                    codec.releaseOutputBuffer(outputBufferIndex, false)
                }

                // If end of stream
                if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                    break
                }
            }

            codec.stop()
            codec.release()
            extractor.release()
            // val sampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            // val channelCount = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            // val audioFormat =
            //     if (channelCount == 1) {
            //         AudioFormat.CHANNEL_OUT_MONO
            //     } else {
            //         AudioFormat.CHANNEL_OUT_STEREO
            //     }

            // // Playback the cached file
            // playbackCachedFile(cacheFile, sampleRate, audioFormat)
        } catch (e: IOException) {
            e.printStackTrace()
        } finally {
            outputStream.close()
            // cacheOutputStream?.close()
        }
    }

    /**
     * Ensure to close the descriptor when done to free resources.
     */
    fun close() {
        try {
            pfd.close()
        } catch (e: IOException) {
            e.printStackTrace()
        }
    }
    /*
    private fun playbackCachedFile(
        file: File,
        sampleRate: Int,
        audioFormat: Int,
    ) {
        val bufferSize =
            AudioTrack.getMinBufferSize(
                sampleRate,
                audioFormat,
                AudioFormat.ENCODING_PCM_16BIT,
            )

        val audioTrack =
            AudioTrack(
                AudioManager.STREAM_MUSIC,
                sampleRate,
                audioFormat,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize,
                AudioTrack.MODE_STREAM,
            )

        val buffer = ByteArray(bufferSize)

        Log.d("ExpoSpeechService", "file path: ${file.absolutePath}")
        FileInputStream(file).use { fileInputStream ->
            audioTrack.play()
            var bytesRead: Int
            while (fileInputStream.read(buffer).also { bytesRead = it } != -1) {
                audioTrack.write(buffer, 0, bytesRead)
            }
            audioTrack.stop()
            audioTrack.release()
        }
    }
     */
}
