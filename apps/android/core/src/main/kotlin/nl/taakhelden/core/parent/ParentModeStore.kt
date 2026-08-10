package nl.taakhelden.core.parent

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import nl.taakhelden.core.api.ApiClientException
import nl.taakhelden.core.api.IdempotencyKey
import nl.taakhelden.core.i18n.UserMessage
import nl.taakhelden.core.realtime.FamilyRoomClient
import nl.taakhelden.core.realtime.FamilyRoomConnectionState

/** Where the open-task count is published for the home-screen widget. */
public interface OpenTaskCountSink {
    public fun update(count: Int)
}

public object NoopOpenTaskCountSink : OpenTaskCountSink {
    override fun update(count: Int): Unit = Unit
}

public data class ParentModeState(
    val activeSurface: ParentSurface = ParentSurface.GOEDKEUREN,
    val snapshot: ParentDashboardSnapshot? = null,
    val selectedApprovalId: String? = null,
    val selectedApprovalIds: Set<String> = emptySet(),
    val acknowledgedBulkPhotoReview: Boolean = false,
    val fullscreenPhoto: ParentPhotoAsset? = null,
    val exportReceipt: ParentExportReceipt? = null,
    val deletionSucceeded: Boolean = false,
    val deletionFailure: UserMessage? = null,
    val isLoading: Boolean = false,
    val isBulkApproving: Boolean = false,
    val loadFailure: UserMessage? = null,
    val connectionState: FamilyRoomConnectionState = FamilyRoomConnectionState.Disconnected,
    val isSessionActive: Boolean = false,
    val needsParentAccount: Boolean = false,
    val bulkFailureCount: Int = 0,
    val draftTaskTitle: String = "",
    val draftTaskPoints: Int = 10,
    val draftRewardTitle: String = "",
    val draftRewardPrice: Int = 40,
)

/**
 * Drives parent mode: the dashboard snapshot, the approval queue, and the management
 * surfaces behind the parental gate.
 */
public class ParentModeStore(
    private val api: ParentApi,
    private val familyRoomClient: FamilyRoomClient,
    private val scope: CoroutineScope,
    public val syncCoordinator: ParentSyncCoordinator = ParentSyncCoordinator(),
    private val openTaskCountSink: OpenTaskCountSink = NoopOpenTaskCountSink,
) {
    private val _state = MutableStateFlow(ParentModeState())
    public val state: StateFlow<ParentModeState> = _state.asStateFlow()

    private var exportJob: Job? = null

    public fun setActiveSurface(surface: ParentSurface) {
        _state.value = _state.value.copy(activeSurface = surface)
    }

    public fun updateDraftTaskTitle(value: String) {
        _state.value = _state.value.copy(draftTaskTitle = value)
    }

    public fun updateDraftTaskPoints(value: Int) {
        _state.value = _state.value.copy(draftTaskPoints = value.coerceIn(1, 100))
    }

    public fun updateDraftRewardTitle(value: String) {
        _state.value = _state.value.copy(draftRewardTitle = value)
    }

    public fun updateDraftRewardPrice(value: Int) {
        _state.value = _state.value.copy(draftRewardPrice = value.coerceIn(1, 500))
    }

    public fun setAcknowledgedBulkPhotoReview(value: Boolean) {
        _state.value = _state.value.copy(acknowledgedBulkPhotoReview = value)
    }

    public fun clearExportReceipt() {
        _state.value = _state.value.copy(exportReceipt = null)
    }

    public suspend fun beginSession() {
        if (_state.value.isSessionActive) return

        _state.value = _state.value.copy(isSessionActive = true)
        connectRealtime()
        refresh(ParentSyncTrigger.APP_BECAME_ACTIVE)
    }

    public suspend fun handleBackgroundPushRefresh() {
        refresh(ParentSyncTrigger.BACKGROUND_PUSH)
    }

    public fun endSession() {
        exportJob?.cancel()
        exportJob = null
        familyRoomClient.disconnect()
        _state.value = _state.value.copy(
            isSessionActive = false,
            connectionState = FamilyRoomConnectionState.Disconnected,
            selectedApprovalIds = emptySet(),
            acknowledgedBulkPhotoReview = false,
            fullscreenPhoto = null,
            selectedApprovalId = null,
            exportReceipt = null,
            deletionSucceeded = false,
            deletionFailure = null,
            bulkFailureCount = 0,
            needsParentAccount = false,
        )
    }

    public suspend fun refresh(trigger: ParentSyncTrigger) {
        _state.value = _state.value.copy(
            isLoading = true,
            loadFailure = null,
            needsParentAccount = false,
        )
        syncCoordinator.begin(trigger)

        try {
            val dashboard = api.fetchParentDashboard()
            openTaskCountSink.update(dashboard.openTaskCount)

            // Keep a valid selection: after an approval resolves, the previously selected
            // card is gone, and an iPad-width detail pane with a dangling id looks broken.
            val currentSelection = _state.value.selectedApprovalId
            val nextSelection = if (dashboard.approvalItem(currentSelection) != null) {
                currentSelection
            } else {
                dashboard.approvalSections.firstOrNull()?.items?.firstOrNull()?.id
            }

            _state.value = _state.value.copy(
                snapshot = dashboard,
                selectedApprovalId = nextSelection,
            )
            syncCoordinator.finish(trigger, dashboard.lastSyncedAt)
        } catch (error: ApiClientException) {
            val needsAccount = error === ApiClientException.ParentSessionMissing
            _state.value = _state.value.copy(
                needsParentAccount = needsAccount,
                loadFailure = error.userMessage,
            )
            syncCoordinator.fail(trigger, error.userMessage.name)
        } catch (error: Exception) {
            _state.value = _state.value.copy(loadFailure = UserMessage.TRANSPORT_GENERIC)
            syncCoordinator.fail(trigger, error.message.orEmpty())
        } finally {
            _state.value = _state.value.copy(isLoading = false)
        }
    }

    public suspend fun approve(item: ApprovalQueueItem) {
        val key = IdempotencyKey.forApproval(item.id)
        mutateApprovalState(ParentSyncTrigger.APPROVAL_RESOLVED) {
            api.approveApproval(item.id, key)
        }
    }

    public suspend fun sendRedo(item: ApprovalQueueItem, note: String) {
        val key = IdempotencyKey.forRedo(item.id)
        mutateApprovalState(ParentSyncTrigger.APPROVAL_RESOLVED) {
            api.sendRedo(item.id, note, key)
        }
    }

    public suspend fun updateSoundPreference(isEnabled: Boolean) {
        val currentSnapshot = _state.value.snapshot
        if (currentSnapshot == null) {
            runCatching { api.updateParentSettings(isEnabled) }
            return
        }

        syncCoordinator.begin(ParentSyncTrigger.SETTINGS_CHANGED)
        try {
            val updated = api.updateParentSettings(isEnabled)
            _state.value = _state.value.copy(
                snapshot = currentSnapshot.copy(settings = updated),
            )
            syncCoordinator.finish(ParentSyncTrigger.SETTINGS_CHANGED)
        } catch (error: Exception) {
            _state.value = _state.value.copy(loadFailure = UserMessage.TRANSPORT_GENERIC)
            syncCoordinator.fail(ParentSyncTrigger.SETTINGS_CHANGED, error.message.orEmpty())
        }
    }

    public suspend fun requestExport() {
        exportJob?.cancel()
        val job = scope.launch {
            val receipt = try {
                api.requestParentDataExport()
            } catch (_: Exception) {
                ParentExportReceipt(ExportReceiptMessage.FAILED)
            }
            _state.value = _state.value.copy(exportReceipt = receipt)
        }
        exportJob = job
        job.join()
    }

    /** Returns true when the account was deleted; false means re-auth is needed. */
    public suspend fun requestDeleteAccount(): Boolean = try {
        api.deleteParentAccount()
        _state.value = _state.value.copy(deletionSucceeded = true, deletionFailure = null)
        true
    } catch (error: ApiClientException) {
        _state.value = _state.value.copy(deletionFailure = error.userMessage)
        false
    } catch (_: Exception) {
        _state.value = _state.value.copy(deletionFailure = UserMessage.TRANSPORT_GENERIC)
        false
    }

    public suspend fun requestDeleteAccount(appleIdentityToken: String): Boolean = try {
        api.deleteParentAccount(appleIdentityToken)
        _state.value = _state.value.copy(deletionSucceeded = true, deletionFailure = null)
        true
    } catch (error: ApiClientException) {
        _state.value = _state.value.copy(deletionFailure = error.userMessage)
        false
    } catch (_: Exception) {
        _state.value = _state.value.copy(deletionFailure = UserMessage.TRANSPORT_GENERIC)
        false
    }

    public suspend fun createTaskFromDraft(defaultChildIds: List<String>) {
        val title = _state.value.draftTaskTitle.trim()
        if (title.isEmpty()) return

        val childIds = defaultChildIds.filter { it.isNotEmpty() }
        if (childIds.isEmpty()) {
            _state.value = _state.value.copy(loadFailure = UserMessage.PARENT_TASKS_NEED_CHILD)
            return
        }

        try {
            val snapshot = api.createManagedTask(
                title = title,
                points = maxOf(_state.value.draftTaskPoints, 1),
                childIds = childIds,
                idempotencyKey = IdempotencyKey.forTaskCreate(),
            )
            _state.value = _state.value.copy(snapshot = snapshot, draftTaskTitle = "")
        } catch (error: Exception) {
            _state.value = _state.value.copy(loadFailure = failureFor(error))
        }
    }

    public suspend fun archiveTask(id: String) {
        try {
            _state.value = _state.value.copy(snapshot = api.archiveManagedTask(id))
        } catch (error: Exception) {
            _state.value = _state.value.copy(loadFailure = failureFor(error))
        }
    }

    public suspend fun createRewardFromDraft() {
        val title = _state.value.draftRewardTitle.trim()
        if (title.isEmpty()) return

        try {
            val snapshot = api.createManagedReward(
                title = title,
                price = maxOf(_state.value.draftRewardPrice, 1),
                idempotencyKey = IdempotencyKey.forRewardCreate(),
            )
            _state.value = _state.value.copy(snapshot = snapshot, draftRewardTitle = "")
        } catch (error: Exception) {
            _state.value = _state.value.copy(loadFailure = failureFor(error))
        }
    }

    public suspend fun archiveReward(id: String) {
        try {
            _state.value = _state.value.copy(snapshot = api.archiveManagedReward(id))
        } catch (error: Exception) {
            _state.value = _state.value.copy(loadFailure = failureFor(error))
        }
    }

    public suspend fun approveSelectedItems(): Unit = coroutineScope {
        val items = selectedItems()
        if (bulkApprovalValidation() != BulkApprovalValidation.ALLOWED) return@coroutineScope

        _state.value = _state.value.copy(isBulkApproving = true, bulkFailureCount = 0)
        try {
            // Bound the concurrency: a parent clearing a weekend backlog should not open
            // twenty parallel writes against the family's Durable Object.
            val gate = Semaphore(BULK_CONCURRENCY_LIMIT)
            val results = items.map { item ->
                val key = IdempotencyKey.forApproval(item.id)
                async {
                    gate.withPermit {
                        runCatching { api.approveApproval(item.id, key) }.isSuccess
                    }
                }
            }.awaitAll()

            val failures = results.count { !it }
            refresh(ParentSyncTrigger.APPROVAL_RESOLVED)

            _state.value = _state.value.copy(
                bulkFailureCount = failures,
                selectedApprovalIds = emptySet(),
                acknowledgedBulkPhotoReview = false,
            )
        } finally {
            _state.value = _state.value.copy(isBulkApproving = false)
        }
    }

    public suspend fun openFullscreenPhoto(item: ApprovalQueueItem) {
        _state.value = _state.value.copy(selectedApprovalId = item.id)
        var asset = item.photoAsset
        if (asset == null) {
            _state.value = _state.value.copy(fullscreenPhoto = null)
            return
        }
        if (asset.previewUrl == null) {
            // Signed URLs are minted only when a parent actually opens the photo.
            runCatching { api.fetchPhotoUrl(asset.id) }.getOrNull()?.let { url ->
                asset = asset.copy(previewUrl = url)
            }
        }
        _state.value = _state.value.copy(fullscreenPhoto = asset)
    }

    public fun closeFullscreenPhoto() {
        _state.value = _state.value.copy(fullscreenPhoto = null)
    }

    public fun selectApproval(id: String?) {
        _state.value = _state.value.copy(selectedApprovalId = id)
    }

    public fun isSelected(item: ApprovalQueueItem): Boolean =
        _state.value.selectedApprovalIds.contains(item.id)

    public fun toggleSelection(item: ApprovalQueueItem) {
        val current = _state.value
        val ids = if (current.selectedApprovalIds.contains(item.id)) {
            current.selectedApprovalIds - item.id
        } else {
            current.selectedApprovalIds + item.id
        }

        // Deselecting the last photo card retracts the acknowledgement, so it can never
        // carry over silently into a later, different selection.
        val stillHasPhoto = ids.any { current.snapshot?.approvalItem(it)?.hasPhoto == true }
        _state.value = current.copy(
            selectedApprovalIds = ids,
            acknowledgedBulkPhotoReview = current.acknowledgedBulkPhotoReview && stillHasPhoto,
        )
    }

    public fun selectedItems(): List<ApprovalQueueItem> {
        val snapshot = _state.value.snapshot ?: return emptyList()
        return snapshot.approvalSections
            .flatMap { it.items }
            .sortedBy { it.submittedAt }
            .filter { _state.value.selectedApprovalIds.contains(it.id) }
    }

    public fun bulkApprovalValidation(): BulkApprovalValidation =
        ParentApprovalRules.validateBulkApproval(
            selectedItems = selectedItems(),
            acknowledgedPhotoReview = _state.value.acknowledgedBulkPhotoReview,
        )

    private fun connectRealtime() {
        familyRoomClient.connect(
            onStatusChange = { state ->
                _state.value = _state.value.copy(connectionState = state)
            },
            onEvent = {
                scope.launch { refresh(ParentSyncTrigger.WEBSOCKET_RECONNECT) }
            },
        )
    }

    private suspend fun mutateApprovalState(
        trigger: ParentSyncTrigger,
        operation: suspend () -> ParentDashboardSnapshot,
    ) {
        syncCoordinator.begin(trigger)
        try {
            val snapshot = operation()
            _state.value = _state.value.copy(snapshot = snapshot)
            syncCoordinator.finish(trigger, snapshot.lastSyncedAt)

            val current = _state.value
            val prunedSelection = current.selectedApprovalIds
                .filter { snapshot.approvalItem(it) != null }
                .toSet()
            val nextSelected = if (snapshot.approvalItem(current.selectedApprovalId) != null) {
                current.selectedApprovalId
            } else {
                snapshot.approvalSections.firstOrNull()?.items?.firstOrNull()?.id
            }
            _state.value = current.copy(
                snapshot = snapshot,
                selectedApprovalIds = prunedSelection,
                selectedApprovalId = nextSelected,
            )
        } catch (error: Exception) {
            _state.value = _state.value.copy(loadFailure = failureFor(error))
            syncCoordinator.fail(trigger, error.message.orEmpty())
        }
    }

    private fun failureFor(error: Exception): UserMessage = when (error) {
        is ApiClientException -> error.userMessage
        else -> UserMessage.TRANSPORT_GENERIC
    }

    public companion object {
        public const val BULK_CONCURRENCY_LIMIT: Int = 4
    }
}
