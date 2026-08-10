package nl.taakhelden.core.child

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import nl.taakhelden.core.api.ChildTodayViewDTO
import nl.taakhelden.core.api.TaakHeldenApiClient
import nl.taakhelden.core.api.TodayBalanceDTO
import nl.taakhelden.core.celebration.CelebrationService
import nl.taakhelden.core.sync.MutationQueue
import nl.taakhelden.core.sync.MutationQueueOutcome
import nl.taakhelden.core.sync.PhotoBonusService
import nl.taakhelden.core.sync.QueuedMutation
import nl.taakhelden.core.sync.QueuedMutationKind
import nl.taakhelden.core.sync.SyncEngine
import java.time.Duration
import java.time.Instant

public sealed interface ChildDayLoadState {
    public data object Loading : ChildDayLoadState
    public data class Ready(val today: ChildTodayViewDTO) : ChildDayLoadState
    public data class EmptyAllDone(val balance: TodayBalanceDTO) : ChildDayLoadState
    public data object EmptyNoTasks : ChildDayLoadState

    /** A parent set an active pause for this child — show a gentle rest state. */
    public data class Paused(val reason: String?) : ChildDayLoadState
    public data object Offline : ChildDayLoadState
    public data object Error : ChildDayLoadState
}

/** What just happened to a photo upload, so the UI can say something kind about it. */
public enum class ChildDayNotice {
    UNDO_EXPIRED,
    PHOTO_UPLOAD_FAILED,
}

public class ChildDayStore(
    private val apiClient: TaakHeldenApiClient,
    private val mutationQueue: MutationQueue,
    private val syncEngine: SyncEngine,
    private val celebrationService: CelebrationService,
    private val photoBonusService: PhotoBonusService,
    private val now: () -> Instant = Instant::now,
) {
    private val _state = MutableStateFlow<ChildDayLoadState>(ChildDayLoadState.Loading)
    public val state: StateFlow<ChildDayLoadState> = _state.asStateFlow()

    private val _optimisticCompletedIds = MutableStateFlow<Set<String>>(emptySet())
    public val optimisticCompletedIds: StateFlow<Set<String>> =
        _optimisticCompletedIds.asStateFlow()

    private val _notice = MutableStateFlow<ChildDayNotice?>(null)
    public val notice: StateFlow<ChildDayNotice?> = _notice.asStateFlow()

    /**
     * Timestamps of completions made in this session, keyed by instance id. Used to decide
     * whether the 5-minute undo window is still open.
     */
    private val completionTimestamps = mutableMapOf<String, Instant>()

    /** Returns true if the undo button should be offered for [instanceId]. */
    public fun isInUndoWindow(instanceId: String): Boolean {
        val stamp = completionTimestamps[instanceId] ?: return false
        return Duration.between(stamp, now()).seconds < UNDO_WINDOW_SECONDS
    }

    public fun clearNotice() {
        _notice.value = null
    }

    public suspend fun load() {
        _notice.value = null
        _state.value = ChildDayLoadState.Loading
        try {
            // WS-PAUSE: a rest day wins over the task list, so a paused child never sees
            // a to-do list they are not meant to work on today.
            apiClient.authStore.childSession?.childId?.let { memberId ->
                val pause = runCatching { apiClient.fetchChildPause(memberId) }.getOrNull()
                if (pause != null && pause.active) {
                    _state.value = ChildDayLoadState.Paused(pause.reason)
                    return
                }
            }

            val today = apiClient.fetchChildToday()
            _state.value = when {
                today.instances.isNotEmpty() -> ChildDayLoadState.Ready(today)
                today.balance.todayTotal == 0 -> ChildDayLoadState.EmptyNoTasks
                else -> ChildDayLoadState.EmptyAllDone(today.balance)
            }
        } catch (_: Exception) {
            // With work still queued, "offline" is the honest and reassuring message:
            // the child's checked-off tasks are safe and will be sent.
            _state.value = if (mutationQueue.hasPendingWork) {
                ChildDayLoadState.Offline
            } else {
                ChildDayLoadState.Error
            }
        }
    }

    public suspend fun complete(instanceId: String, reduceMotion: Boolean) {
        mutationQueue.enqueue(
            QueuedMutation(kind = QueuedMutationKind.COMPLETE, targetId = instanceId),
        )
        _optimisticCompletedIds.value = _optimisticCompletedIds.value + instanceId
        completionTimestamps[instanceId] = now()
        celebrationService.celebrateTaskCompleted(reduceMotion)

        syncEngine.syncNow()
        load()
    }

    /**
     * Undoes a just-completed task within the 5-minute server window.
     *
     * The idempotency key is derived from the instance id, so a retry after a dropped
     * response never sends two undo ops for the same task.
     */
    public suspend fun undo(instanceId: String) {
        mutationQueue.enqueue(
            QueuedMutation(
                key = "undo:$instanceId",
                kind = QueuedMutationKind.UNDO,
                targetId = instanceId,
            ),
        )
        _optimisticCompletedIds.value = _optimisticCompletedIds.value - instanceId
        completionTimestamps.remove(instanceId)

        val outcomes = syncEngine.syncNow()
        if (outcomes.any { it is MutationQueueOutcome.UndoWindowExpired }) {
            _notice.value = ChildDayNotice.UNDO_EXPIRED
        }
        load()
    }

    public suspend fun uploadPhoto(instanceId: String, jpegData: ByteArray) {
        try {
            photoBonusService.uploadTaskPhoto(instanceId, jpegData)
            load()
        } catch (_: Exception) {
            _notice.value = ChildDayNotice.PHOTO_UPLOAD_FAILED
        }
    }

    private companion object {
        /** Matches the server-side undo window (`POST /instances/:id/undo` — 5 min). */
        const val UNDO_WINDOW_SECONDS = 300L
    }
}
