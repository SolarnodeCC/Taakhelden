package nl.taakhelden.core

import kotlinx.coroutines.test.runTest
import nl.taakhelden.core.api.HttpMethod
import nl.taakhelden.core.api.HttpRequest
import nl.taakhelden.core.api.HttpResponse
import nl.taakhelden.core.api.HttpTransporting
import nl.taakhelden.core.api.MemberAvatarStateDTO
import nl.taakhelden.core.api.OptionalNullString
import nl.taakhelden.core.api.TaakHeldenApiClient
import nl.taakhelden.core.auth.AuthStore
import nl.taakhelden.core.auth.ChildAgeBand
import nl.taakhelden.core.auth.ChildSession
import nl.taakhelden.core.auth.InMemorySecureStore
import nl.taakhelden.core.designsystem.AvatarCatalog
import nl.taakhelden.core.designsystem.ContrastMath
import nl.taakhelden.core.designsystem.HeroProgress
import nl.taakhelden.core.designsystem.WPalettes
import nl.taakhelden.core.designsystem.YoungMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WorkstreamTest {

    @Test
    fun `picture PIN match requires the exact sequence`() {
        assertTrue(
            YoungMode.matchesPicturePin(
                selection = listOf("🦊", "🐼", "🦁"),
                stored = listOf("🦊", "🐼", "🦁"),
            ),
        )
        assertFalse(
            YoungMode.matchesPicturePin(
                selection = listOf("🦊", "🦁", "🐼"),
                stored = listOf("🦊", "🐼", "🦁"),
            ),
        )
        assertFalse(
            YoungMode.matchesPicturePin(
                selection = listOf("🦊"),
                stored = listOf("🦊", "🐼", "🦁"),
            ),
        )
    }

    @Test
    fun `young mode tap target meets the accessibility floor`() {
        assertTrue(YoungMode.MIN_TAP_TARGET_DP >= 64)
    }

    @Test
    fun `hero level matches the server curve`() {
        assertEquals(1, HeroProgress.levelFromLifetime(0))
        assertEquals(1, HeroProgress.levelFromLifetime(99))
        assertEquals(1, HeroProgress.levelFromLifetime(100))
        assertEquals(3, HeroProgress.levelFromLifetime(300))
    }

    @Test
    fun `family goal fraction caps at one`() {
        assertEquals(1.0, HeroProgress.goalFraction(earned = 120, target = 100), 0.0001)
        assertEquals(0.5, HeroProgress.goalFraction(earned = 50, target = 100), 0.0001)
        assertEquals(0.0, HeroProgress.goalFraction(earned = 10, target = 0), 0.0001)
    }

    @Test
    fun `equip payload distinguishes omit from explicit null`() = runTest {
        val transport = RecordingTransport(
            responseBody = """
                {"memberId":"m1","equipped":{},"unlocked":[],"level":1,"lifetimeEarned":0}
            """.trimIndent(),
        )
        val authStore = AuthStore(InMemorySecureStore()).apply {
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
        val client = TaakHeldenApiClient(transport, authStore)

        val state: MemberAvatarStateDTO = client.equipAvatar(
            memberId = "m1",
            hat = OptionalNullString.Value(null),
            background = OptionalNullString.Omit,
            accessory = OptionalNullString.Value("acc_star"),
            idempotencyKey = "key-1",
        )
        assertEquals("m1", state.memberId)

        val body = requireNotNull(transport.lastRequest?.body)
        assertTrue("explicit null must be sent", body.contains("\"hat\":null"))
        assertTrue(body.contains("acc_star"))
        assertFalse("omitted slot must not appear", body.contains("background"))
    }

    @Test
    fun `on-accent colour contrasts against accent fills`() {
        assertTrue(
            ContrastMath.contrastRatio(WPalettes.kid.onAccent, WPalettes.kid.accent) >= 3.0,
        )
        assertTrue(
            ContrastMath.contrastRatio(WPalettes.teen.onAccent, WPalettes.teen.accent) >= 3.0,
        )
        assertTrue(
            ContrastMath.contrastRatio(WPalettes.parent.onAccent, WPalettes.parent.accent) >= 3.0,
        )
    }

    @Test
    fun `age band maps from the server age mode`() {
        assertEquals(ChildAgeBand.YOUNG, AvatarCatalog.ageBandFrom("young"))
        assertEquals(ChildAgeBand.TEEN, AvatarCatalog.ageBandFrom("teen"))
        assertEquals(ChildAgeBand.MID, AvatarCatalog.ageBandFrom("mid"))
        assertEquals(ChildAgeBand.MID, AvatarCatalog.ageBandFrom(null))
    }

    @Test
    fun `age band maps from birth year`() {
        assertEquals(
            ChildAgeBand.YOUNG,
            AvatarCatalog.ageBandFromBirthYear(birthYear = 2020, currentYear = 2026),
        )
        assertEquals(
            ChildAgeBand.MID,
            AvatarCatalog.ageBandFromBirthYear(birthYear = 2016, currentYear = 2026),
        )
        assertEquals(
            ChildAgeBand.TEEN,
            AvatarCatalog.ageBandFromBirthYear(birthYear = 2012, currentYear = 2026),
        )
    }

    @Test
    fun `avatar emoji round-trips through its id`() {
        AvatarCatalog.selectableIds.forEach { id ->
            assertEquals(id, AvatarCatalog.idForEmoji(AvatarCatalog.emojiFor(id)))
        }
        // An unknown id must not crash the child's profile — it falls back to the fox.
        assertEquals("🦊", AvatarCatalog.emojiFor("does-not-exist"))
    }
}

/** Captures the last request so tests can assert on the encoded body and headers. */
internal class RecordingTransport(
    private val responseBody: String,
    private val statusCode: Int = 200,
) : HttpTransporting {
    var lastRequest: HttpRequest? = null
        private set

    var lastAccessToken: String? = null
        private set

    val requests: MutableList<HttpRequest> = mutableListOf()

    override suspend fun send(request: HttpRequest, accessToken: String?): HttpResponse {
        lastRequest = request
        lastAccessToken = accessToken
        requests += request
        return HttpResponse(statusCode = statusCode, body = responseBody)
    }
}

internal fun HttpRequest.isPatch(): Boolean = method == HttpMethod.PATCH
