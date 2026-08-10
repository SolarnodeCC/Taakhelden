package nl.taakhelden.core.sync

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import nl.taakhelden.core.api.TaakHeldenApiClient

/**
 * Drains the [MutationQueue] against `POST /sync`.
 *
 * Outcome handling is what keeps a child's screen honest: applied and already-completed
 * both mean "the server has it", and the permanent rejections are dropped so the queue
 * cannot spin forever. Only a genuine failure stays queued for the next attempt.
 */
public class SyncEngine(
    private val apiClient: TaakHeldenApiClient,
    private val mutationQueue: MutationQueue,
) {
    private val _lastSyncAt = MutableStateFlow<String?>(null)
    public val lastSyncAt: StateFlow<String?> = _lastSyncAt.asStateFlow()

    private val _isSyncing = MutableStateFlow(false)
    public val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    private val _lastErrorMessage = MutableStateFlow<String?>(null)
    public val lastErrorMessage: StateFlow<String?> = _lastErrorMessage.asStateFlow()

    public suspend fun syncNow(): List<MutationQueueOutcome> {
        val queued = mutationQueue.pending.value
        if (queued.isEmpty() && _lastSyncAt.value == null) {
            return emptyList()
        }

        _isSyncing.value = true
        try {
            val response = apiClient.sync(
                since = _lastSyncAt.value,
                mutations = queued.map { it.asSyncDto() },
            )

            val outcomes = response.results.map { result ->
                val outcome = mutationQueue.outcome(result)
                when (outcome) {
                    is MutationQueueOutcome.Applied,
                    is MutationQueueOutcome.AlreadyCompleted,
                        -> mutationQueue.remove(result.key)

                    is MutationQueueOutcome.InsufficientPoints,
                    is MutationQueueOutcome.Dropped,
                    is MutationQueueOutcome.UndoWindowExpired,
                        -> // Permanent rejections: drop them so they are not retried forever.
                        mutationQueue.remove(result.key)

                    is MutationQueueOutcome.Failed -> Unit
                }
                outcome
            }

            _lastSyncAt.value = response.serverTime
            _lastErrorMessage.value = null
            return outcomes
        } catch (error: Exception) {
            _lastErrorMessage.value = error.message
            return emptyList()
        } finally {
            _isSyncing.value = false
        }
    }
}
