package nl.taakhelden.core.api

import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.json.Json
import nl.taakhelden.core.i18n.LocalisedFailure
import nl.taakhelden.core.i18n.UserMessage
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

public enum class HttpMethod(public val wire: String) {
    GET("GET"),
    POST("POST"),
    PATCH("PATCH"),
    DELETE("DELETE"),
    PUT("PUT"),
}

public data class HttpRequest(
    val path: String,
    val method: HttpMethod = HttpMethod.GET,
    val body: String? = null,
    val headers: Map<String, String> = emptyMap(),
    val requiresAuth: Boolean = false,
    val requiresContractV2: Boolean = false,
    val idempotencyKey: String? = null,
)

public data class HttpResponse(
    val statusCode: Int,
    val body: String,
    val headers: Map<String, String> = emptyMap(),
)

public object ContractSource {
    public const val BUNDLED_SNAPSHOT_PATH: String = "apps/android/openapi/openapi.json"
    public const val UPSTREAM_SNAPSHOT_PATH: String = "docs/openapi/taakhelden-core-v1.json"
    public const val CONTRACT_VERSION_HEADER: String = "2"
}

/** Mirrors `HTTPTransportError` on iOS. */
public sealed class HttpTransportException(
    message: String,
    cause: Throwable? = null,
) : Exception(message, cause) {

    public abstract val failure: LocalisedFailure

    public class InvalidUrl(public val url: String) : HttpTransportException("Invalid URL: $url") {
        override val failure: LocalisedFailure = LocalisedFailure(UserMessage.TRANSPORT_INVALID_URL)
    }

    public class Transport(cause: Throwable) : HttpTransportException("Transport failure", cause) {
        override val failure: LocalisedFailure = LocalisedFailure(UserMessage.TRANSPORT_OFFLINE)
    }

    public class HttpStatus(
        public val statusCode: Int,
        public val envelope: ApiErrorEnvelope?,
    ) : HttpTransportException("HTTP $statusCode") {
        override val failure: LocalisedFailure =
            LocalisedFailure(UserMessage.TRANSPORT_GENERIC, envelope?.error?.message)
    }

    public class Decoding(cause: Throwable) : HttpTransportException("Decoding failure", cause) {
        override val failure: LocalisedFailure = LocalisedFailure(UserMessage.TRANSPORT_DECODING)
    }
}

public interface HttpTransporting {
    public suspend fun send(request: HttpRequest, accessToken: String?): HttpResponse
}

/**
 * Lenient JSON codec shared by every API call.
 *
 * `ignoreUnknownKeys` matters for forward compatibility: a Worker deploy that adds a
 * response field must not crash installed Android clients (Swift's `Codable` ignores
 * unknown keys by default, so this keeps the two platforms behaving alike).
 */
public val apiJson: Json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    encodeDefaults = true
    isLenient = true
}

public class OkHttpTransport(
    private val baseUrl: String,
    private val client: OkHttpClient = defaultClient(),
) : HttpTransporting {

    override suspend fun send(request: HttpRequest, accessToken: String?): HttpResponse {
        val url = resolve(request.path) ?: throw HttpTransportException.InvalidUrl(request.path)

        val requestBody: RequestBody? = when {
            request.body != null -> request.body.toRequestBody(JSON_MEDIA_TYPE)
            // OkHttp requires a (possibly empty) body for POST/PATCH/PUT.
            request.method in METHODS_REQUIRING_BODY -> EMPTY_JSON_BODY
            else -> null
        }

        val builder = Request.Builder()
            .url(url)
            .method(request.method.wire, requestBody)
            .header("Content-Type", "application/json")

        if (request.requiresContractV2) {
            builder.header("X-Contract-Version", ContractSource.CONTRACT_VERSION_HEADER)
        }
        if (accessToken != null && request.requiresAuth) {
            builder.header("Authorization", "Bearer $accessToken")
        }
        request.idempotencyKey?.let { builder.header("Idempotency-Key", it) }
        request.headers.forEach { (key, value) -> builder.header(key, value) }

        val response = try {
            client.newCall(builder.build()).await()
        } catch (io: IOException) {
            throw HttpTransportException.Transport(io)
        }

        response.use { raw ->
            val bodyText = raw.body?.string().orEmpty()
            if (raw.code >= 400) {
                throw HttpTransportException.HttpStatus(raw.code, decodeEnvelope(bodyText))
            }
            return HttpResponse(
                statusCode = raw.code,
                body = bodyText,
                headers = raw.headers.toMap(),
            )
        }
    }

    /**
     * Resolves a request path against the base URL.
     *
     * The base URL carries a path prefix (`…/v1`), so a bare `toHttpUrl()` on the path
     * would drop it. `resolve` keeps the prefix the way `URL(string:relativeTo:)` does
     * on iOS: a leading `/` on the request path is relative to the base *path*, not the
     * host root, so paths are appended rather than replacing `/v1`.
     */
    private fun resolve(path: String): HttpUrl? {
        val base = baseUrl.toHttpUrlOrNull() ?: return null
        val normalisedBase = if (base.encodedPath.endsWith("/")) base else {
            base.newBuilder().encodedPath(base.encodedPath + "/").build()
        }
        return normalisedBase.resolve(path.removePrefix("/"))
    }

    private fun decodeEnvelope(body: String): ApiErrorEnvelope? = runCatching {
        apiJson.decodeFromString(ApiErrorEnvelope.serializer(), body)
    }.getOrNull()

    public companion object {
        private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
        private val EMPTY_JSON_BODY = "".toRequestBody(JSON_MEDIA_TYPE)
        private val METHODS_REQUIRING_BODY =
            setOf(HttpMethod.POST, HttpMethod.PATCH, HttpMethod.PUT)

        public fun defaultClient(): OkHttpClient = OkHttpClient.Builder().build()
    }
}

private fun okhttp3.Headers.toMap(): Map<String, String> =
    (0 until size).associate { index -> name(index) to value(index) }

/** Bridges OkHttp's callback API onto coroutines with proper cancellation. */
private suspend fun Call.await(): Response = suspendCancellableCoroutine { continuation ->
    enqueue(object : Callback {
        override fun onFailure(call: Call, e: IOException) {
            if (continuation.isCancelled) return
            continuation.resumeWithException(e)
        }

        override fun onResponse(call: Call, response: Response) {
            continuation.resume(response)
        }
    })
    continuation.invokeOnCancellation { runCatching { cancel() } }
}
