package expo.modules.speechrecognition

import android.os.ParcelFileDescriptor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File
import java.io.FileInputStream
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
            writeFileToStream(audioFile, sink)
        }
    }

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

    /**
     * Ensure to close the descriptor when done to free resources.
     */
    fun close() {
        try {
            pfd?.close()
        } catch (e: IOException) {
            e.printStackTrace()
        }
    }
}
