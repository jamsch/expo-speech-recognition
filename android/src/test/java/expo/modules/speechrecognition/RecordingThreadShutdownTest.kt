package expo.modules.speechrecognition

import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.locks.LockSupport
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class RecordingThreadShutdownTest {
    @Test
    fun `blocked recording worker is unblocked after its graceful drain timeout`() {
        val workerStarted = CountDownLatch(1)
        val releaseWorker = CountDownLatch(1)
        val unblockCalled = AtomicBoolean(false)
        val worker =
            Thread {
                workerStarted.countDown()
                releaseWorker.await()
            }.apply {
                isDaemon = true
                start()
            }
        assertTrue(workerStarted.await(1, TimeUnit.SECONDS))

        try {
            val drained =
                awaitRecordingThreadShutdown(
                    worker,
                    gracefulTimeoutMillis = 10,
                    forcedTimeoutMillis = 1_000,
                ) {
                    unblockCalled.set(true)
                    releaseWorker.countDown()
                }

            assertTrue(unblockCalled.get())
            assertTrue(drained)
            assertFalse(worker.isAlive)
        } finally {
            releaseWorker.countDown()
            worker.join(1_000)
        }
    }

    @Test
    fun `shutdown returns when a recording worker cannot be unblocked`() {
        val workerStarted = CountDownLatch(1)
        val releaseWorker = AtomicBoolean(false)
        val worker =
            Thread {
                workerStarted.countDown()
                while (!releaseWorker.get()) {
                    LockSupport.parkNanos(TimeUnit.MILLISECONDS.toNanos(1))
                }
            }.apply {
                isDaemon = true
                start()
            }
        assertTrue(workerStarted.await(1, TimeUnit.SECONDS))

        try {
            val drained =
                awaitRecordingThreadShutdown(
                    worker,
                    gracefulTimeoutMillis = 10,
                    forcedTimeoutMillis = 10,
                ) {}

            assertFalse(drained)
            assertTrue(worker.isAlive)
        } finally {
            releaseWorker.set(true)
            LockSupport.unpark(worker)
            worker.join(1_000)
        }
    }
}
