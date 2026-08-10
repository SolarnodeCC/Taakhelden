package nl.taakhelden.core.api

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Coalesces concurrent token refreshes.
 *
 * Without this, a burst of parallel 401s (the parent dashboard fires today/tasks/rewards
 * at once) would each spend the refresh token. The Worker rotates refresh tokens, so the
 * second call would fail and log the parent out. Mirrors the iOS actor of the same name.
 */
public class TokenRefreshCoordinator {
    private val mutex = Mutex()
    private var childRefresh: CompletableDeferred<ChildSessionResultDTO>? = null
    private var parentRefresh: CompletableDeferred<ParentSessionResultDTO>? = null

    public suspend fun refreshChild(
        refreshToken: String,
        transport: HttpTransporting,
    ): ChildSessionResultDTO {
        mutex.withLock { childRefresh }?.let { return it.await() }

        val deferred = CompletableDeferred<ChildSessionResultDTO>()
        val shouldRun = mutex.withLock {
            if (childRefresh == null) {
                childRefresh = deferred
                true
            } else {
                false
            }
        }
        if (!shouldRun) {
            return mutex.withLock { childRefresh }!!.await()
        }

        try {
            val body = apiJson.encodeToString(
                RefreshTokenBody.serializer(),
                RefreshTokenBody(refreshToken),
            )
            val response = transport.send(
                HttpRequest(
                    path = "/auth/child-session/refresh",
                    method = HttpMethod.POST,
                    body = body,
                ),
                accessToken = null,
            )
            val result = apiJson.decodeFromString(
                ChildSessionResultDTO.serializer(),
                response.body,
            )
            deferred.complete(result)
            return result
        } catch (throwable: Throwable) {
            deferred.completeExceptionally(throwable)
            throw throwable
        } finally {
            mutex.withLock { childRefresh = null }
        }
    }

    public suspend fun refreshParent(
        refreshToken: String,
        transport: HttpTransporting,
    ): ParentSessionResultDTO {
        mutex.withLock { parentRefresh }?.let { return it.await() }

        val deferred = CompletableDeferred<ParentSessionResultDTO>()
        val shouldRun = mutex.withLock {
            if (parentRefresh == null) {
                parentRefresh = deferred
                true
            } else {
                false
            }
        }
        if (!shouldRun) {
            return mutex.withLock { parentRefresh }!!.await()
        }

        try {
            val body = apiJson.encodeToString(
                RefreshTokenBody.serializer(),
                RefreshTokenBody(refreshToken),
            )
            val response = transport.send(
                HttpRequest(path = "/auth/refresh", method = HttpMethod.POST, body = body),
                accessToken = null,
            )
            val result = apiJson.decodeFromString(
                ParentSessionResultDTO.serializer(),
                response.body,
            )
            deferred.complete(result)
            return result
        } catch (throwable: Throwable) {
            deferred.completeExceptionally(throwable)
            throw throwable
        } finally {
            mutex.withLock { parentRefresh = null }
        }
    }
}

@kotlinx.serialization.Serializable
internal data class RefreshTokenBody(val refreshToken: String)
