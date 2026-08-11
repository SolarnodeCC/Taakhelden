package nl.taakhelden.core

import kotlinx.coroutines.test.runTest
import nl.taakhelden.core.api.HttpMethod
import nl.taakhelden.core.api.HttpRequest
import nl.taakhelden.core.api.HttpTransportException
import nl.taakhelden.core.api.OkHttpTransport
import nl.taakhelden.core.config.AppConfiguration
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.net.URI

class ReleaseReadinessTest {

    private lateinit var server: MockWebServer

    @Before
    fun setUp() {
        server = MockWebServer().apply { start() }
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `build config override wins over the production fallback`() {
        assertEquals(
            "https://staging.example/v1",
            AppConfiguration.apiBaseUrl(
                buildConfigValue = "https://staging.example/v1",
                environment = emptyMap(),
            ),
        )
    }

    @Test
    fun `environment override applies when no build config value is set`() {
        assertEquals(
            "https://env.example/v1",
            AppConfiguration.apiBaseUrl(
                buildConfigValue = null,
                environment = mapOf(AppConfiguration.OVERRIDE_ENV_KEY to "https://env.example/v1"),
            ),
        )
    }

    @Test
    fun `base url never falls back to localhost`() {
        val url = AppConfiguration.apiBaseUrl(buildConfigValue = null, environment = emptyMap())
        assertEquals(AppConfiguration.PRODUCTION_API_BASE_URL, url)
        assertFalse(url.contains("localhost"))
    }

    @Test
    fun `an unexpanded gradle placeholder does not win over the fallback`() {
        val url = AppConfiguration.apiBaseUrl(
            buildConfigValue = "\$TAAKHELDEN_API_BASE_URL",
            environment = emptyMap(),
        )
        assertEquals(AppConfiguration.PRODUCTION_API_BASE_URL, url)
    }

    @Test
    fun `the production api uses https and the v1 prefix`() {
        val uri = URI(AppConfiguration.PRODUCTION_API_BASE_URL)
        assertEquals("https", uri.scheme)
        assertTrue(uri.path.endsWith("/v1"))
    }

    @Test
    fun `request paths are appended to the base path, not rooted at the host`() = runTest {
        // Regression guard: a naive URL join drops the `/v1` prefix and every call 404s.
        server.enqueue(MockResponse().setBody("{}"))
        val transport = OkHttpTransport(server.url("/v1").toString())

        transport.send(HttpRequest(path = "/instances/today"), accessToken = null)

        assertEquals("/v1/instances/today", server.takeRequest().path)
    }

    @Test
    fun `auth, contract and idempotency headers are sent as specified`() = runTest {
        server.enqueue(MockResponse().setBody("{}"))
        val transport = OkHttpTransport(server.url("/v1").toString())

        transport.send(
            HttpRequest(
                path = "/instances/abc/complete",
                method = HttpMethod.POST,
                requiresAuth = true,
                requiresContractV2 = true,
                idempotencyKey = "complete-abc",
            ),
            accessToken = STUB_TOKEN,
        )

        val recorded = server.takeRequest()
        assertEquals("POST", recorded.method)
        assertEquals("Bearer $STUB_TOKEN", recorded.getHeader("Authorization"))
        assertEquals("2", recorded.getHeader("X-Contract-Version"))
        assertEquals("complete-abc", recorded.getHeader("Idempotency-Key"))
    }

    @Test
    fun `a bearer token is withheld when the request does not require auth`() = runTest {
        server.enqueue(MockResponse().setBody("{}"))
        val transport = OkHttpTransport(server.url("/v1").toString())

        transport.send(HttpRequest(path = "/auth/family-code"), accessToken = STUB_TOKEN)

        assertEquals(null, server.takeRequest().getHeader("Authorization"))
    }

    @Test
    fun `an error envelope is surfaced with its status code`() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(403)
                .setBody("""{"error":{"code":"FORBIDDEN","message":"Niet toegestaan."}}"""),
        )
        val transport = OkHttpTransport(server.url("/v1").toString())

        val error = runCatching {
            transport.send(HttpRequest(path = "/instances/today"), accessToken = null)
        }.exceptionOrNull()

        val status = error as? HttpTransportException.HttpStatus
        assertEquals(403, status?.statusCode)
        assertEquals("FORBIDDEN", status?.envelope?.error?.code)
        assertEquals("Niet toegestaan.", status?.failure?.serverMessage)
    }
}

/**
 * Obviously-not-a-credential stand-in for a bearer token.
 *
 * Kept as a named constant rather than an inline literal so secret scanners do not have
 * to guess whether a token-shaped string next to `accessToken =` is real.
 */
private const val STUB_TOKEN = "test-fixture-not-a-credential"
