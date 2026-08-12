package nl.taakhelden.core

import kotlinx.coroutines.test.runTest
import nl.taakhelden.core.api.HttpMethod
import nl.taakhelden.core.api.HttpRequest
import nl.taakhelden.core.api.HttpResponse
import nl.taakhelden.core.api.HttpTransportException
import nl.taakhelden.core.api.HttpTransporting
import nl.taakhelden.core.api.TaakHeldenApiClient
import nl.taakhelden.core.auth.AuthStore
import nl.taakhelden.core.auth.ChildAgeBand
import nl.taakhelden.core.auth.ChildSession
import nl.taakhelden.core.auth.InMemorySecureStore
import nl.taakhelden.core.celebration.CelebrationEffects
import nl.taakhelden.core.celebration.CelebrationService
import nl.taakhelden.core.child.ChildDayLoadState
import nl.taakhelden.core.child.ChildDayStore
import nl.taakhelden.core.sync.InMemoryMutationQueueStore
import nl.taakhelden.core.sync.MutationQueue
import nl.taakhelden.core.sync.PhotoBonusService
import nl.taakhelden.core.sync.QueuedMutation
import nl.taakhelden.core.sync.QueuedMutationKind
import nl.taakhelden.core.sync.SyncEngine
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException
import java.time.Instant

/** Routes each path by URL so one fake can serve the whole day-load sequence. */
private class RoutingTransport(
    private val handler: (HttpRequest) -> HttpResponse,
) : HttpTransporting {
    val paths: MutableList<String> = mutableListOf()

    override suspend fun send(request: HttpRequest, accessToken: String?): HttpResponse {
        paths += request.path
        return handler(request)
    }
}

class ChildDayStoreTest {

    private val todayBody = """
        {
          "viewer": "child",
          "date": "2026-08-01",
          "instances": [{
            "id": "i1", "taskId": "t1", "childId": "c1", "date": "2026-08-01",
            "status": "open", "title": "Kamer opruimen", "category": "household", "points": 10
          }],
          "balance": {
            "childId": "c1", "balance": 12, "todayCompleted": 0, "todayTotal": 1,
            "weekProgress": 0.0, "streakDays": 3, "lifetimeEarned": 120
          }
        }
    """.trimIndent()

    private fun emptyToday(todayTotal: Int) = """
        {
          "viewer": "child", "date": "2026-08-01", "instances": [],
          "balance": {
            "childId": "c1", "balance": 12, "todayCompleted": $todayTotal,
            "todayTotal": $todayTotal, "weekProgress": 1.0, "streakDays": 3,
            "lifetimeEarned": 120
          }
        }
    """.trimIndent()

    private fun storeWith(
        transport: HttpTransporting,
        queue: MutationQueue = MutationQueue(InMemoryMutationQueueStore()),
        now: () -> Instant = Instant::now,
    ): ChildDayStore {
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
        val api = TaakHeldenApiClient(transport, authStore)
        return ChildDayStore(
            apiClient = api,
            mutationQueue = queue,
            syncEngine = SyncEngine(api, queue),
            celebrationService = CelebrationService(RecordingEffects()),
            photoBonusService = PhotoBonusService(api),
            now = now,
        )
    }

    @Test
    fun `an active pause wins over the task list`() = runTest {
        val transport = RoutingTransport { request ->
            when {
                request.path.endsWith("/pause") -> HttpResponse(
                    200,
                    """{"pauses":[{"id":"p1","childId":"c1","startsOn":"2026-08-01",
                       "reason":"Griep","active":true}]}""".trimIndent(),
                )

                else -> HttpResponse(200, todayBody)
            }
        }
        val store = storeWith(transport)

        store.load()

        // A paused child must not be shown a to-do list they are not meant to work on.
        assertEquals(ChildDayLoadState.Paused("Griep"), store.state.value)
        assertFalse("today must not even be fetched", transport.paths.any { it.contains("today") })
    }

    @Test
    fun `a 404 from the pause endpoint is not an error`() = runTest {
        val transport = RoutingTransport { request ->
            if (request.path.endsWith("/pause")) {
                throw HttpTransportException.HttpStatus(404, null)
            }
            HttpResponse(200, todayBody)
        }

        val store = storeWith(transport)
        store.load()

        // WS-PAUSE is not deployed everywhere; absence means "no pause", not "broken".
        assertTrue(store.state.value is ChildDayLoadState.Ready)
    }

    @Test
    fun `an empty day distinguishes all-done from nothing-assigned`() = runTest {
        val allDone = storeWith(RoutingTransport { request ->
            if (request.path.endsWith("/pause")) HttpResponse(200, """{"pauses":[]}""")
            else HttpResponse(200, emptyToday(todayTotal = 3))
        })
        allDone.load()
        assertTrue(allDone.state.value is ChildDayLoadState.EmptyAllDone)

        val noTasks = storeWith(RoutingTransport { request ->
            if (request.path.endsWith("/pause")) HttpResponse(200, """{"pauses":[]}""")
            else HttpResponse(200, emptyToday(todayTotal = 0))
        })
        noTasks.load()
        assertEquals(ChildDayLoadState.EmptyNoTasks, noTasks.state.value)
    }

    @Test
    fun `offline with queued work reassures rather than errors`() = runTest {
        val queue = MutationQueue(InMemoryMutationQueueStore()).apply {
            enqueue(QueuedMutation(kind = QueuedMutationKind.COMPLETE, targetId = "i1"))
        }
        val store = storeWith(
            RoutingTransport { throw IOException("offline") },
            queue = queue,
        )

        store.load()

        // "Your tasks are safe" beats a red error a child cannot act on.
        assertEquals(ChildDayLoadState.Offline, store.state.value)
    }

    @Test
    fun `offline with nothing queued is a plain error`() = runTest {
        val store = storeWith(RoutingTransport { throw IOException("offline") })

        store.load()

        assertEquals(ChildDayLoadState.Error, store.state.value)
    }

    @Test
    fun `the undo window closes after five minutes`() = runTest {
        var clock = Instant.parse("2026-08-01T10:00:00Z")
        val queue = MutationQueue(InMemoryMutationQueueStore())
        val store = storeWith(
            RoutingTransport { request ->
                when {
                    request.path.endsWith("/pause") -> HttpResponse(200, """{"pauses":[]}""")
                    request.path == "/sync" && request.method == HttpMethod.POST -> HttpResponse(
                        200,
                        """{"results":[],"changes":{"ledger":[],"instances":[]},
                           "serverTime":"2026-08-01T10:00:00Z"}""".trimIndent(),
                    )

                    else -> HttpResponse(200, todayBody)
                }
            },
            queue = queue,
            now = { clock },
        )

        store.complete("i1", reduceMotion = true)
        assertTrue("undo is offered right after completing", store.isInUndoWindow("i1"))

        clock = clock.plusSeconds(299)
        assertTrue(store.isInUndoWindow("i1"))

        clock = clock.plusSeconds(2)
        assertFalse("the 5-minute server window has closed", store.isInUndoWindow("i1"))
    }

    @Test
    fun `undo uses a key derived from the instance so retries cannot double-undo`() = runTest {
        val queue = MutationQueue(InMemoryMutationQueueStore())
        val store = storeWith(
            RoutingTransport { request ->
                when {
                    request.path.endsWith("/pause") -> HttpResponse(200, """{"pauses":[]}""")
                    request.path == "/sync" -> throw IOException("offline")
                    else -> HttpResponse(200, todayBody)
                }
            },
            queue = queue,
        )

        store.undo("i1")

        assertEquals("undo:i1", queue.pending.value.single().key)
        assertEquals(QueuedMutationKind.UNDO, queue.pending.value.single().kind)
    }
}

private class RecordingEffects : CelebrationEffects {
    override val childSoundsEnabled: Boolean = true
    var haptics = 0
    override fun playSuccessHaptic() { haptics++ }
    override fun playTaskCompleteChime() = Unit
}
