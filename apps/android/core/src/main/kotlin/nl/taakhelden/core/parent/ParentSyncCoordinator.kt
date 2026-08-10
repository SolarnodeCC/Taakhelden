package nl.taakhelden.core.parent

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.time.Instant

public enum class ParentSyncTrigger {
    APP_BECAME_ACTIVE,
    MANUAL_REFRESH,
    APPROVAL_RESOLVED,
    BACKGROUND_PUSH,
    WEBSOCKET_RECONNECT,
    SETTINGS_CHANGED,
}

public sealed interface ParentSyncState {
    public data object Idle : ParentSyncState
    public data class Syncing(val trigger: ParentSyncTrigger) : ParentSyncState
    public data class Synced(val trigger: ParentSyncTrigger, val at: Instant) : ParentSyncState
    public data class Failed(val trigger: ParentSyncTrigger, val message: String) : ParentSyncState
}

/** Tracks *why* the parent dashboard last refreshed, so the header can explain itself. */
public class ParentSyncCoordinator {
    private val _state = MutableStateFlow<ParentSyncState>(ParentSyncState.Idle)
    public val state: StateFlow<ParentSyncState> = _state.asStateFlow()

    private val _lastTrigger = MutableStateFlow<ParentSyncTrigger?>(null)
    public val lastTrigger: StateFlow<ParentSyncTrigger?> = _lastTrigger.asStateFlow()

    public fun begin(trigger: ParentSyncTrigger) {
        _lastTrigger.value = trigger
        _state.value = ParentSyncState.Syncing(trigger)
    }

    public fun finish(trigger: ParentSyncTrigger, at: Instant = Instant.now()) {
        _lastTrigger.value = trigger
        _state.value = ParentSyncState.Synced(trigger, at)
    }

    public fun fail(trigger: ParentSyncTrigger, message: String) {
        _lastTrigger.value = trigger
        _state.value = ParentSyncState.Failed(trigger, message)
    }
}
