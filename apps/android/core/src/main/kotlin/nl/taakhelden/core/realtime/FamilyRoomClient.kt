package nl.taakhelden.core.realtime

import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import nl.taakhelden.core.api.TaakHeldenApiClient
import nl.taakhelden.core.api.mintFamilyRoomToken
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

public sealed interface FamilyRoomConnectionState {
    public data object Disconnected : FamilyRoomConnectionState
    public data object Connecting : FamilyRoomConnectionState
    public data object Connected : FamilyRoomConnectionState
    public data class WaitingToReconnect(val seconds: Int) : FamilyRoomConnectionState
}

public enum class FamilyRoomEvent {
    APPROVALS_CHANGED,
    TODAY_CHANGED,
    SETTINGS_CHANGED,
    POINTS_CHANGED,
    REDEMPTIONS_CHANGED,
}

public data class FamilyRoomReconnectPolicy(
    val delaysInSeconds: List<Int>,
) {
    public fun delay(forAttempt: Int): Int {
        val first = delaysInSeconds.firstOrNull() ?: return 0
        if (forAttempt <= 0) return first
        return delaysInSeconds[minOf(forAttempt, delaysInSeconds.size - 1)]
    }

    public companion object {
        public val parentDefault: FamilyRoomReconnectPolicy =
            FamilyRoomReconnectPolicy(listOf(2, 4, 8))
    }
}

public interface FamilyRoomClient {
    public fun connect(
        onStatusChange: (FamilyRoomConnectionState) -> Unit,
        onEvent: (FamilyRoomEvent) -> Unit,
    )

    public fun disconnect()
}

/** Maps a FamilyRoom DO frame onto the coarse event the parent dashboard reacts to. */
public object FamilyRoomEventMapper {
    public fun map(rawFrame: String): FamilyRoomEvent? {
        val json = runCatching {
            Json.parseToJsonElement(rawFrame) as? JsonObject
        }.getOrNull() ?: return null
        val event = (json["event"] as? JsonPrimitive)?.content ?: return null
        return mapEventName(event)
    }

    public fun mapEventName(event: String): FamilyRoomEvent = when (event) {
        "instance.updated" -> FamilyRoomEvent.APPROVALS_CHANGED
        "points.changed" -> FamilyRoomEvent.POINTS_CHANGED
        "redemption.created", "redemption.updated" -> FamilyRoomEvent.REDEMPTIONS_CHANGED
        "badge.earned" -> FamilyRoomEvent.TODAY_CHANGED
        else -> FamilyRoomEvent.TODAY_CHANGED
    }
}

/**
 * Live FamilyRoom client — parent JWT → short-lived WS token → WebSocket.
 *
 * The WS token is minted per connection attempt rather than reused: it is deliberately
 * short-lived, so a reconnect after a long background period must fetch a fresh one.
 */
public class LiveFamilyRoomClient(
    private val apiClient: TaakHeldenApiClient,
    private val baseUrl: String,
    private val scope: CoroutineScope,
    private val policy: FamilyRoomReconnectPolicy = FamilyRoomReconnectPolicy.parentDefault,
    private val client: OkHttpClient = defaultClient(),
) : FamilyRoomClient {

    private var webSocket: WebSocket? = null
    private var connectJob: Job? = null
    private var onStatusChange: ((FamilyRoomConnectionState) -> Unit)? = null
    private var onEvent: ((FamilyRoomEvent) -> Unit)? = null
    private var reconnectAttempt = 0

    @Volatile
    private var shouldRun = false

    private val lock = Any()

    override fun connect(
        onStatusChange: (FamilyRoomConnectionState) -> Unit,
        onEvent: (FamilyRoomEvent) -> Unit,
    ) {
        synchronized(lock) {
            this.onStatusChange = onStatusChange
            this.onEvent = onEvent
            shouldRun = true
            reconnectAttempt = 0
        }
        openConnection()
    }

    override fun disconnect() {
        val socket = synchronized(lock) {
            shouldRun = false
            val current = webSocket
            webSocket = null
            current
        }
        connectJob?.cancel()
        connectJob = null
        socket?.close(NORMAL_CLOSURE, null)
        emitStatus(FamilyRoomConnectionState.Disconnected)
    }

    private fun openConnection() {
        if (!shouldRun) return
        connectJob?.cancel()
        connectJob = scope.launch {
            emitStatus(FamilyRoomConnectionState.Connecting)
            val wsUrl = runCatching {
                val token = apiClient.mintFamilyRoomToken()
                buildWebSocketUrl(token.token)
            }.getOrNull()

            if (wsUrl == null) {
                scheduleReconnect()
                return@launch
            }

            val request = Request.Builder().url(wsUrl).build()
            synchronized(lock) {
                webSocket = client.newWebSocket(request, FamilyRoomListener())
            }
        }
    }

    /**
     * `baseUrl` ends in `…/v1`, and the socket lives at `…/v1/ws`. We also flip the
     * scheme so an `https` API base becomes a `wss` socket.
     */
    private fun buildWebSocketUrl(token: String): String? {
        val base = baseUrl.toHttpUrlOrNull() ?: return null
        val path = base.encodedPath.trimEnd('/')
        return base.newBuilder()
            .encodedPath("$path/ws")
            .setQueryParameter("token", token)
            .build()
            .toString()
    }

    private inner class FamilyRoomListener : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            synchronized(lock) { reconnectAttempt = 0 }
            emitStatus(FamilyRoomConnectionState.Connected)
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            FamilyRoomEventMapper.map(text)?.let(::emitEvent)
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            scheduleReconnect()
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            if (code != NORMAL_CLOSURE) scheduleReconnect()
        }
    }

    private fun scheduleReconnect() {
        val delaySeconds = synchronized(lock) {
            if (!shouldRun) return
            val attempt = reconnectAttempt
            reconnectAttempt += 1
            policy.delay(attempt)
        }

        emitStatus(FamilyRoomConnectionState.WaitingToReconnect(delaySeconds))
        connectJob?.cancel()
        connectJob = scope.launch {
            delay(delaySeconds * 1000L)
            openConnection()
        }
    }

    private fun emitStatus(state: FamilyRoomConnectionState) {
        synchronized(lock) { onStatusChange }?.invoke(state)
    }

    private fun emitEvent(event: FamilyRoomEvent) {
        synchronized(lock) { onEvent }?.invoke(event)
    }

    public companion object {
        private const val NORMAL_CLOSURE = 1000

        public fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
            // OkHttp sends WebSocket pings for us; 25s matches the iOS ping loop and keeps
            // the Durable Object connection alive through carrier NAT timeouts.
            .pingInterval(25, TimeUnit.SECONDS)
            .build()
    }
}

/** Deterministic stand-in used by previews and tests. */
public class FakeFamilyRoomClient : FamilyRoomClient {
    private var onStatusChange: ((FamilyRoomConnectionState) -> Unit)? = null
    private var onEvent: ((FamilyRoomEvent) -> Unit)? = null

    override fun connect(
        onStatusChange: (FamilyRoomConnectionState) -> Unit,
        onEvent: (FamilyRoomEvent) -> Unit,
    ) {
        this.onStatusChange = onStatusChange
        this.onEvent = onEvent
        onStatusChange(FamilyRoomConnectionState.Connecting)
        onStatusChange(FamilyRoomConnectionState.Connected)
    }

    override fun disconnect() {
        onStatusChange?.invoke(FamilyRoomConnectionState.Disconnected)
        onStatusChange = null
        onEvent = null
    }

    public fun simulateEvent(event: FamilyRoomEvent) {
        onEvent?.invoke(event)
    }

    public fun simulateReconnect(
        attempt: Int,
        policy: FamilyRoomReconnectPolicy = FamilyRoomReconnectPolicy.parentDefault,
    ) {
        onStatusChange?.invoke(
            FamilyRoomConnectionState.WaitingToReconnect(policy.delay(attempt)),
        )
    }
}
