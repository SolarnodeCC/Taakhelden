package nl.taakhelden.core

import kotlinx.coroutines.test.runTest
import nl.taakhelden.core.api.HttpRequest
import nl.taakhelden.core.api.HttpResponse
import nl.taakhelden.core.api.HttpTransporting
import nl.taakhelden.core.api.TaakHeldenApiClient
import nl.taakhelden.core.auth.AuthStore
import nl.taakhelden.core.auth.ChildAgeBand
import nl.taakhelden.core.auth.ChildSession
import nl.taakhelden.core.auth.InMemorySecureStore
import nl.taakhelden.core.sync.InMemoryMutationQueueStore
import nl.taakhelden.core.sync.MutationQueue
import nl.taakhelden.core.sync.MutationQueueOutcome
import nl.taakhelden.core.sync.QueuedMutation
import nl.taakhelden.core.sync.QueuedMutationKind
import nl.taakhelden.core.sync.SyncEngine
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The drain rules are the heart of offline correctness: what stays queued after a sync
 * decides whether a child's checked-off task is eventually awarded, silently lost, or
 * awarded twice.
 */
class SyncEngineTest {

    private fun clientWith(responseBody: String, transport: HttpTransporting): TaakHeldenApiClient {
        val authStore = AuthStore(InMemorySecureStore()).apply {
            storeChildSession(
                ChildSession(
                    childId = "c1",
                    displayName = "Sam",
                    avatar = "🦊",
                    ageBand = ChildAgeBand.MID,
                    accessToken = "tok",
                    refreshToken = "ref",
                ),
                pin = "1234",
            )
        }
        return TaakHeldenApiClient(transport, authStore)
    }

    private fun syncResponse(vararg results: String) = """
        {
          "results": [${results.joinToString(",")}],
          "changes": { "ledger": [], "instances": [] },
          "serverTime": "2026-08-01T10:00:00Z"
        }
    """.trimIndent()

    @Test
    fun `applied mutations leave the queue`() = runTest {
        val store = InMemoryMutationQueueStore()
        val queue = MutationQueue(store)
        queue.enqueue(
            QueuedMutation(key = "k1", kind = QueuedMutationKind.COMPLETE, targetId = "i1"),
        )

        val body = syncResponse("""{"key":"k1","status":"applied","newBalance":30}""")
        val engine = SyncEngine(clientWith(body, RecordingTransport(body)), queue)

        val outcomes = engine.syncNow()

        assertEquals(listOf(MutationQueueOutcome.Applied(30)), outcomes)
        assertTrue("applied work must not be retried", queue.pending.value.isEmpty())
    }

    @Test
    fun `a genuine failure stays queued for the next attempt`() = runTest {
        val store = InMemoryMutationQueueStore()
        val queue = MutationQueue(store)
        queue.enqueue(
            QueuedMutation(key = "k1", kind = QueuedMutationKind.COMPLETE, targetId = "i1"),
        )

        val body = syncResponse(
            """{"key":"k1","status":"rejected","code":"SERVER_BUSY","message":"Later"}""",
        )
        val engine = SyncEngine(clientWith(body, RecordingTransport(body)), queue)

        engine.syncNow()

        // Dropping this would silently lose the child's completed task.
        assertEquals(1, queue.pending.value.size)
        assertEquals("k1", queue.pending.value.first().key)
    }

    @Test
    fun `permanent rejections are dropped so the queue cannot spin forever`() = runTest {
        val store = InMemoryMutationQueueStore()
        val queue = MutationQueue(store)
        queue.enqueue(QueuedMutation(key = "a", kind = QueuedMutationKind.REDEEM, targetId = "r1"))
        queue.enqueue(QueuedMutation(key = "b", kind = QueuedMutationKind.UNDO, targetId = "i1"))
        queue.enqueue(
            QueuedMutation(key = "c", kind = QueuedMutationKind.COMPLETE, targetId = "i2"),
        )

        val body = syncResponse(
            """{"key":"a","status":"rejected","code":"INSUFFICIENT_POINTS"}""",
            """{"key":"b","status":"rejected","code":"UNDO_WINDOW_EXPIRED"}""",
            """{"key":"c","status":"rejected","code":"TASK_ALREADY_COMPLETED"}""",
        )
        val engine = SyncEngine(clientWith(body, RecordingTransport(body)), queue)

        val outcomes = engine.syncNow()

        assertEquals(
            listOf(
                MutationQueueOutcome.InsufficientPoints,
                MutationQueueOutcome.UndoWindowExpired,
                MutationQueueOutcome.AlreadyCompleted,
            ),
            outcomes,
        )
        assertTrue(queue.pending.value.isEmpty())
    }

    @Test
    fun `a transport failure keeps everything queued and reports an error`() = runTest {
        val store = InMemoryMutationQueueStore()
        val queue = MutationQueue(store)
        queue.enqueue(QueuedMutation(key = "k1", kind = QueuedMutationKind.COMPLETE, targetId = "i"))

        val failing = object : HttpTransporting {
            override suspend fun send(request: HttpRequest, accessToken: String?): HttpResponse =
                throw java.io.IOException("offline")
        }
        val engine = SyncEngine(clientWith("", failing), queue)

        val outcomes = engine.syncNow()

        assertTrue(outcomes.isEmpty())
        assertEquals(1, queue.pending.value.size)
        assertEquals(false, engine.isSyncing.value)
    }

    @Test
    fun `an empty queue before the first sync does not call the server`() = runTest {
        val queue = MutationQueue(InMemoryMutationQueueStore())
        val transport = RecordingTransport(syncResponse())
        val engine = SyncEngine(clientWith(syncResponse(), transport), queue)

        val outcomes = engine.syncNow()

        assertTrue(outcomes.isEmpty())
        assertTrue("no round trip is worth making here", transport.requests.isEmpty())
    }
}
