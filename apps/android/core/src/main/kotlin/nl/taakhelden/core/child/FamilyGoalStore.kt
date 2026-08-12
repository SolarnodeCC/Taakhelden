package nl.taakhelden.core.child

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import nl.taakhelden.core.api.FamilyGoalProgressDTO
import nl.taakhelden.core.api.TaakHeldenApiClient
import java.util.UUID

public sealed interface FamilyGoalLoadState {
    public data object Idle : FamilyGoalLoadState
    public data object Loading : FamilyGoalLoadState
    public data class Ready(val progress: FamilyGoalProgressDTO?) : FamilyGoalLoadState
    public data object Failed : FamilyGoalLoadState
}

public class FamilyGoalStore(
    private val apiClient: TaakHeldenApiClient,
) {
    private val _loadState = MutableStateFlow<FamilyGoalLoadState>(FamilyGoalLoadState.Idle)
    public val loadState: StateFlow<FamilyGoalLoadState> = _loadState.asStateFlow()

    public val progress: FamilyGoalProgressDTO?
        get() = (_loadState.value as? FamilyGoalLoadState.Ready)?.progress

    public suspend fun load() {
        val previous = _loadState.value
        _loadState.value = FamilyGoalLoadState.Loading
        try {
            _loadState.value =
                FamilyGoalLoadState.Ready(apiClient.fetchActiveFamilyGoalProgress().progress)
        } catch (_: Exception) {
            // Keep the last successful progress on screen when a refresh fails — a
            // flickering shared goal reads as "we lost your progress".
            _loadState.value = (previous as? FamilyGoalLoadState.Ready) ?: FamilyGoalLoadState.Failed
        }
    }
}

public enum class FamilyGoalCreateStatus {
    CREATED,
    FAILED,
}

public data class ParentFamilyGoalSettingsState(
    val title: String = "",
    val icon: String = "🍕",
    val targetPoints: Int = 500,
    val status: FamilyGoalCreateStatus? = null,
    val isSaving: Boolean = false,
) {
    public val canCreate: Boolean
        get() = title.isNotBlank() && icon.isNotBlank() && targetPoints >= MIN_TARGET && !isSaving

    public companion object {
        public const val MIN_TARGET: Int = 50
        public const val MAX_TARGET: Int = 10_000
        public const val TARGET_STEP: Int = 50
    }
}

public class ParentFamilyGoalSettingsStore(
    private val apiClient: TaakHeldenApiClient,
    defaultTitle: String,
) {
    private val _state = MutableStateFlow(ParentFamilyGoalSettingsState(title = defaultTitle))
    public val state: StateFlow<ParentFamilyGoalSettingsState> = _state.asStateFlow()

    private var pendingCreateKey: String? = null

    public fun updateTitle(title: String) {
        _state.value = _state.value.copy(title = title)
    }

    public fun updateIcon(icon: String) {
        _state.value = _state.value.copy(icon = icon)
    }

    public fun updateTargetPoints(targetPoints: Int) {
        _state.value = _state.value.copy(
            targetPoints = targetPoints.coerceIn(
                ParentFamilyGoalSettingsState.MIN_TARGET,
                ParentFamilyGoalSettingsState.MAX_TARGET,
            ),
        )
    }

    public suspend fun create() {
        val current = _state.value
        if (!current.canCreate) return

        _state.value = current.copy(isSaving = true)
        val key = pendingCreateKey ?: UUID.randomUUID().toString()
        pendingCreateKey = key

        try {
            apiClient.createFamilyGoal(
                title = current.title.trim(),
                icon = current.icon.trim(),
                targetPoints = current.targetPoints,
                childIds = emptyList(), // empty = all children (server contract)
                idempotencyKey = key,
            )
            pendingCreateKey = null
            _state.value = _state.value.copy(status = FamilyGoalCreateStatus.CREATED)
        } catch (_: Exception) {
            _state.value = _state.value.copy(status = FamilyGoalCreateStatus.FAILED)
        } finally {
            _state.value = _state.value.copy(isSaving = false)
        }
    }

    /** Test seam for idempotent create retries. */
    public val pendingKeyForTests: String? get() = pendingCreateKey
}
