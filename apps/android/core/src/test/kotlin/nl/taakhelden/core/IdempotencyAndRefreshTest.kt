package nl.taakhelden.core

import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.runTest
import nl.taakhelden.core.api.AvatarCatalogItemDTO
import nl.taakhelden.core.api.HttpRequest
import nl.taakhelden.core.api.HttpResponse
import nl.taakhelden.core.api.HttpTransportException
import nl.taakhelden.core.api.HttpTransporting
import nl.taakhelden.core.api.TaakHeldenApiClient
import nl.taakhelden.core.api.TokenRefreshCoordinator
import nl.taakhelden.core.auth.AuthStore
import nl.taakhelden.core.auth.ChildAgeBand
import nl.taakhelden.core.auth.ChildSession
import nl.taakhelden.core.auth.InMemorySecureStore
import nl.taakhelden.core.child.AvatarShopStore
import nl.taakhelden.core.child.TaskProposalStore
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

private fun childAuthStore() = AuthStore(InMemorySecureStore()).apply {
    storeChildSession(
        ChildSession(
            childId = "m1",
            displayName = "Sam",
            avatar = "🦊",
            ageBand = ChildAgeBand.MID,
            accessToken = "tok",
            refreshToken = "ref",
        ),
        pin = "1234",
    )
}

class IdempotencyAndRefreshTest {

    @Test
    fun `concurrent 401s spend the refresh token exactly once`() = runTest {
        val refreshCalls = AtomicInteger(0)
        val transport = object : HttpTransporting {
            override suspend fun send(request: HttpRequest, accessToken: String?): HttpResponse {
                if (request.path == "/auth/child-session/refresh") {
                    refreshCalls.incrementAndGet()
                    delay(20) // let the other callers pile up behind this one
                    return HttpResponse(
                        200,
                        """{"accessToken":"new","refreshToken":"new-ref","expiresIn":900,
                           "child":{"id":"m1","displayName":"Sam","ageMode":"mid"}}""".trimIndent(),
                    )
                }
                return HttpResponse(200, "{}")
            }
        }

        val coordinator = TokenRefreshCoordinator()
        val results = (1..5).map {
            async { coordinator.refreshChild("ref", transport) }
        }.awaitAll()

        // The Worker rotates refresh tokens: a second spend would invalidate the session
        // and log the family out mid-use.
        assertEquals(1, refreshCalls.get())
        assertTrue(results.all { it.accessToken == "new" })
    }

    @Test
    fun `a failed equip keeps its idempotency key for the retry`() = runTest {
        var failNext = true
        val seenKeys = mutableListOf<String?>()
        val transport = object : HttpTransporting {
            override suspend fun send(request: HttpRequest, accessToken: String?): HttpResponse {
                if (request.path.endsWith("/avatar") && request.method.wire == "PATCH") {
                    seenKeys += request.idempotencyKey
                    if (failNext) {
                        failNext = false
                        throw HttpTransportException.HttpStatus(500, null)
                    }
                }
                return HttpResponse(
                    200,
                    """{"memberId":"m1","equipped":{"hat":"hat_party"},
                       "unlocked":["hat_party"],"level":2,"lifetimeEarned":210}""".trimIndent(),
                )
            }
        }

        val store = AvatarShopStore(TaakHeldenApiClient(transport, childAuthStore()), "m1")
        val item = AvatarCatalogItemDTO(
            id = "hat_party",
            slot = "hat",
            unlockType = "level",
            unlockThreshold = 1,
            previewEmoji = "🎉",
            title = "Feesthoed",
        )
        store.load()

        store.equip(item)
        val keyAfterFailure = store.pendingKey("hat_party")
        assertNotNull("a failed equip must keep its key", keyAfterFailure)

        store.equip(item)

        assertEquals("the retry must reuse the key", listOf(keyAfterFailure, keyAfterFailure), seenKeys)
        assertNull("a successful equip releases the key", store.pendingKey("hat_party"))
    }

    @Test
    fun `a proposal endpoint that is not live yet is not shown as an error`() = runTest {
        val transport = object : HttpTransporting {
            override suspend fun send(request: HttpRequest, accessToken: String?): HttpResponse =
                throw HttpTransportException.HttpStatus(404, null)
        }
        val store = TaskProposalStore(TaakHeldenApiClient(transport, childAuthStore()))

        store.loadProposals()
        assertEquals(emptyList<Any>(), store.proposals)

        store.updateTitle("Ramen lappen")
        store.submit()

        // WS-PROPOSAL is gated server-side; a teen should see their request echoed back
        // rather than an error for a feature that simply is not switched on.
        val submitState = store.submitState.value
        assertTrue(submitState is nl.taakhelden.core.child.ProposalSubmitState.Success)
        assertEquals(
            "Ramen lappen",
            (submitState as nl.taakhelden.core.child.ProposalSubmitState.Success).proposal.title,
        )
    }

    @Test
    fun `a real proposal failure is surfaced`() = runTest {
        val transport = object : HttpTransporting {
            override suspend fun send(request: HttpRequest, accessToken: String?): HttpResponse =
                throw HttpTransportException.HttpStatus(500, null)
        }
        val store = TaskProposalStore(TaakHeldenApiClient(transport, childAuthStore()))

        store.updateTitle("Ramen lappen")
        store.submit()

        assertEquals(
            nl.taakhelden.core.child.ProposalSubmitState.Error,
            store.submitState.value,
        )
    }
}
