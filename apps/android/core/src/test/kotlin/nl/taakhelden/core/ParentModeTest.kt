package nl.taakhelden.core

import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import nl.taakhelden.core.api.ApiClientException
import nl.taakhelden.core.api.ChildPairingRequest
import nl.taakhelden.core.api.FamilyCodeLookup
import nl.taakhelden.core.api.IdempotencyKey
import nl.taakhelden.core.auth.ChildAgeBand
import nl.taakhelden.core.auth.ChildSession
import nl.taakhelden.core.gate.ParentGateCoordinator
import nl.taakhelden.core.gate.ParentGateEntryPoint
import nl.taakhelden.core.gate.ParentGateUnlockMethod
import nl.taakhelden.core.parent.ApprovalQueueItem
import nl.taakhelden.core.parent.ApprovalQueueSection
import nl.taakhelden.core.parent.BulkApprovalValidation
import nl.taakhelden.core.parent.ExportReceiptMessage
import nl.taakhelden.core.parent.ParentApi
import nl.taakhelden.core.parent.ParentApprovalRules
import nl.taakhelden.core.parent.ParentDashboardSnapshot
import nl.taakhelden.core.parent.ParentExportReceipt
import nl.taakhelden.core.parent.ParentManagedReward
import nl.taakhelden.core.parent.ParentManagedTask
import nl.taakhelden.core.parent.ParentModeStore
import nl.taakhelden.core.parent.ParentPhotoAsset
import nl.taakhelden.core.parent.ParentSettingsSnapshot
import nl.taakhelden.core.parent.ParentSyncTrigger
import nl.taakhelden.core.parent.ParentTaskSnapshot
import nl.taakhelden.core.parent.ParentTaskStatus
import nl.taakhelden.core.parent.ParentTodayChildSnapshot
import nl.taakhelden.core.realtime.FakeFamilyRoomClient
import nl.taakhelden.core.realtime.FamilyRoomEvent
import nl.taakhelden.core.realtime.FamilyRoomEventMapper
import nl.taakhelden.core.realtime.FamilyRoomReconnectPolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.util.UUID

class ParentModeTest {

    @Test
    fun `parent gate unlock flow tracks the challenge and the idle timeout`() {
        val coordinator = ParentGateCoordinator()

        coordinator.openGate(ParentGateEntryPoint.HERO_WORDMARK_LONG_PRESS)
        assertTrue(coordinator.isChallengePresented.value)
        assertFalse(coordinator.isParentModePresented.value)

        val now = Instant.now()
        coordinator.unlock(ParentGateUnlockMethod.DEVICE_AUTHENTICATION, now)

        assertFalse(coordinator.isChallengePresented.value)
        assertTrue(coordinator.isParentModePresented.value)
        assertEquals(ParentGateUnlockMethod.DEVICE_AUTHENTICATION, coordinator.lastUnlockMethod)
        assertFalse(coordinator.parentSessionRequiresReauth(now.plusSeconds(9 * 60)))
        assertTrue(coordinator.parentSessionRequiresReauth(now.plusSeconds(11 * 60)))
    }

    @Test
    fun `parent gate does not open parent mode without an unlock`() {
        val coordinator = ParentGateCoordinator()

        coordinator.openGate(ParentGateEntryPoint.BUILD_NUMBER_FIVE_TAP)
        assertTrue(coordinator.isChallengePresented.value)
        assertFalse(coordinator.isParentModePresented.value)

        coordinator.closeGate()
        assertFalse(coordinator.isChallengePresented.value)
        assertFalse(coordinator.isParentModePresented.value)
    }

    @Test
    fun `closing parent mode resets the gate`() {
        val coordinator = ParentGateCoordinator()
        coordinator.openGate(ParentGateEntryPoint.HERO_WORDMARK_LONG_PRESS)
        coordinator.unlock(ParentGateUnlockMethod.PARENT_ACCOUNT)
        assertTrue(coordinator.isParentModePresented.value)

        coordinator.closeParentMode()
        assertFalse(coordinator.isParentModePresented.value)
        assertFalse(coordinator.isChallengePresented.value)
        assertNull(coordinator.activeEntryPoint.value)
    }

    @Test
    fun `bulk approval requires the same child and a photo acknowledgement`() {
        val first = approvalItem(id = "one", childId = "child-sam", withPhoto = true)
        val secondChild = approvalItem(id = "two", childId = "child-noor", withPhoto = false)

        assertEquals(
            BulkApprovalValidation.PHOTO_ACKNOWLEDGEMENT_REQUIRED,
            ParentApprovalRules.validateBulkApproval(listOf(first), false),
        )
        assertEquals(
            BulkApprovalValidation.MIXED_CHILDREN,
            ParentApprovalRules.validateBulkApproval(listOf(first, secondChild), true),
        )
        assertEquals(
            BulkApprovalValidation.ALLOWED,
            ParentApprovalRules.validateBulkApproval(listOf(first), true),
        )
        assertEquals(
            BulkApprovalValidation.EMPTY,
            ParentApprovalRules.validateBulkApproval(emptyList(), true),
        )
    }

    @Test
    fun `photo viewer model never exposes sensitive metadata`() {
        val asset = ParentPhotoAsset(
            id = "photo-safe",
            previewUrl = "https://example.invalid/review.jpg",
            status = "ready",
        )
        assertFalse(asset.showsSensitiveMetadata)
    }

    @Test
    fun `reconnect policy uses the approved backoff sequence`() {
        val policy = FamilyRoomReconnectPolicy.parentDefault

        assertEquals(listOf(2, 4, 8), policy.delaysInSeconds)
        assertEquals(2, policy.delay(forAttempt = 0))
        assertEquals(4, policy.delay(forAttempt = 1))
        assertEquals(8, policy.delay(forAttempt = 2))
        assertEquals(8, policy.delay(forAttempt = 99))
    }

    @Test
    fun `family room frames map onto dashboard events`() {
        assertEquals(
            FamilyRoomEvent.APPROVALS_CHANGED,
            FamilyRoomEventMapper.map("""{"event":"instance.updated"}"""),
        )
        assertEquals(
            FamilyRoomEvent.POINTS_CHANGED,
            FamilyRoomEventMapper.map("""{"event":"points.changed"}"""),
        )
        assertEquals(
            FamilyRoomEvent.REDEMPTIONS_CHANGED,
            FamilyRoomEventMapper.map("""{"event":"redemption.created"}"""),
        )
        // A malformed frame must be ignored rather than triggering a spurious refresh.
        assertNull(FamilyRoomEventMapper.map("not json"))
        assertNull(FamilyRoomEventMapper.map("""{"noEventKey":true}"""))
    }

    @Test
    fun `approval idempotency keys are deterministic and distinct per intent`() {
        assertEquals(
            IdempotencyKey.forApproval("ti_1"),
            IdempotencyKey.forApproval("ti_1"),
        )
        assertEquals(
            IdempotencyKey.forRedo("ti_1"),
            IdempotencyKey.forRedo("ti_1"),
        )
        assertNotEquals(
            IdempotencyKey.forApproval("ti_1"),
            IdempotencyKey.forRedo("ti_1"),
        )
        // Create keys are fresh per intent, so two separate taps make two tasks.
        assertNotEquals(IdempotencyKey.forTaskCreate(), IdempotencyKey.forTaskCreate())
    }

    @Test
    fun `creating a task from the draft lands in the snapshot`() = runTest {
        val api = FakeParentApi()
        val store = ParentModeStore(api, FakeFamilyRoomClient(), TestScope(testScheduler))

        store.refresh(ParentSyncTrigger.MANUAL_REFRESH)
        store.updateDraftTaskTitle("Schoenen wegzetten")
        store.updateDraftTaskPoints(7)
        store.createTaskFromDraft(listOf("child-sam"))

        val task = store.state.value.snapshot?.managedTasks?.first()
        assertEquals("Schoenen wegzetten", task?.title)
        assertEquals(7, task?.points)
        // The draft clears so the same task cannot be added twice by a double tap.
        assertEquals("", store.state.value.draftTaskTitle)
    }

    @Test
    fun `creating a task without a child profile is refused`() = runTest {
        val api = FakeParentApi()
        val store = ParentModeStore(api, FakeFamilyRoomClient(), TestScope(testScheduler))

        store.refresh(ParentSyncTrigger.MANUAL_REFRESH)
        store.updateDraftTaskTitle("Losse taak")
        store.createTaskFromDraft(emptyList())

        assertTrue(api.createdTasks.isEmpty())
        assertEquals(
            nl.taakhelden.core.i18n.UserMessage.PARENT_TASKS_NEED_CHILD,
            store.state.value.loadFailure,
        )
    }

    @Test
    fun `bulk approve clears only the selected items and reuses stable keys`() = runTest {
        val api = FakeParentApi()
        val store = ParentModeStore(api, FakeFamilyRoomClient(), TestScope(testScheduler))

        store.refresh(ParentSyncTrigger.APP_BECAME_ACTIVE)
        val snapshot = requireNotNull(store.state.value.snapshot)

        snapshot.approvalSections[0].items.take(2).forEach(store::toggleSelection)
        store.setAcknowledgedBulkPhotoReview(true)
        assertEquals(BulkApprovalValidation.ALLOWED, store.bulkApprovalValidation())

        store.approveSelectedItems()

        assertEquals(0, store.state.value.selectedApprovalIds.size)
        assertEquals(1, store.state.value.snapshot?.pendingApprovalCount)
        assertEquals(
            ParentSyncTrigger.APPROVAL_RESOLVED,
            store.syncCoordinator.lastTrigger.value,
        )
        // Every approval used the deterministic key for its instance.
        assertEquals(
            api.approvedIds.map { IdempotencyKey.forApproval(it) },
            api.approvalKeys,
        )
    }

    @Test
    fun `deselecting the last photo card retracts the acknowledgement`() = runTest {
        val api = FakeParentApi()
        val store = ParentModeStore(api, FakeFamilyRoomClient(), TestScope(testScheduler))
        store.refresh(ParentSyncTrigger.APP_BECAME_ACTIVE)

        val photoItem = requireNotNull(
            store.state.value.snapshot
                ?.approvalSections
                ?.flatMap { it.items }
                ?.first { it.hasPhoto },
        )

        store.toggleSelection(photoItem)
        store.setAcknowledgedBulkPhotoReview(true)
        assertTrue(store.state.value.acknowledgedBulkPhotoReview)

        store.toggleSelection(photoItem)
        assertFalse(
            "acknowledgement must not survive an empty selection",
            store.state.value.acknowledgedBulkPhotoReview,
        )
    }

    @Test
    fun `a missing parent session surfaces the sign-in prompt`() = runTest {
        val api = FakeParentApi(failWith = ApiClientException.ParentSessionMissing)
        val store = ParentModeStore(api, FakeFamilyRoomClient(), TestScope(testScheduler))

        store.refresh(ParentSyncTrigger.MANUAL_REFRESH)

        assertTrue(store.state.value.needsParentAccount)
        assertEquals(
            nl.taakhelden.core.i18n.UserMessage.PARENT_SESSION_MISSING,
            store.state.value.loadFailure,
        )
    }

    @Test
    fun `deleting an Apple account requires re-authentication first`() = runTest {
        val api = FakeParentApi()
        val store = ParentModeStore(api, FakeFamilyRoomClient(), TestScope(testScheduler))

        assertFalse(store.requestDeleteAccount())
        assertEquals(
            nl.taakhelden.core.i18n.UserMessage.PARENT_REAUTH_REQUIRED,
            store.state.value.deletionFailure,
        )

        assertTrue(store.requestDeleteAccount(appleIdentityToken = "fresh-token"))
        assertTrue(store.state.value.deletionSucceeded)
    }

    // MARK: - Fixtures

    private fun approvalItem(
        id: String,
        childId: String,
        withPhoto: Boolean,
    ) = ApprovalQueueItem(
        id = id,
        childId = childId,
        childName = if (childId == "child-sam") "Sam" else "Noor",
        childAvatar = if (childId == "child-sam") "🦊" else "🐼",
        title = "Kamer opruimen",
        icon = "🧹",
        submittedAt = Instant.now(),
        points = 12,
        photoAsset = if (withPhoto) ParentPhotoAsset(id = "photo-$id", status = "ready") else null,
        photoStatus = if (withPhoto) "ready" else null,
    )
}

/**
 * In-memory [ParentApi] that behaves like the real one for the flows the store drives:
 * approvals disappear when approved, created tasks/rewards show up in the snapshot.
 */
internal class FakeParentApi(
    private val failWith: ApiClientException? = null,
) : ParentApi {

    val approvedIds: MutableList<String> = mutableListOf()
    val approvalKeys: MutableList<String> = mutableListOf()
    val createdTasks: MutableList<ParentManagedTask> = mutableListOf()

    private var snapshot: ParentDashboardSnapshot = initialSnapshot()

    override suspend fun resolveFamilyCode(code: String): FamilyCodeLookup =
        FamilyCodeLookup(familyName = "Familie Vermeer", children = emptyList())

    override suspend fun pairChild(request: ChildPairingRequest): ChildSession = ChildSession(
        childId = request.childId,
        displayName = "Sam",
        avatar = "🦊",
        ageBand = ChildAgeBand.MID,
        accessToken = "access",
        refreshToken = "refresh",
    )

    override suspend fun fetchParentDashboard(): ParentDashboardSnapshot {
        failWith?.let { throw it }
        return snapshot
    }

    override suspend fun approveApproval(
        id: String,
        idempotencyKey: String,
    ): ParentDashboardSnapshot {
        approvedIds += id
        approvalKeys += idempotencyKey
        snapshot = snapshot.removingApproval(id, approved = true)
        return snapshot
    }

    override suspend fun sendRedo(
        id: String,
        note: String,
        idempotencyKey: String,
    ): ParentDashboardSnapshot {
        if (note.isBlank()) throw ApiClientException.InvalidParentNote
        snapshot = snapshot.removingApproval(id, approved = false)
        return snapshot
    }

    override suspend fun updateParentSettings(soundEnabled: Boolean): ParentSettingsSnapshot {
        snapshot = snapshot.copy(settings = snapshot.settings.copy(soundEnabled = soundEnabled))
        return snapshot.settings
    }

    override suspend fun requestParentDataExport(): ParentExportReceipt =
        ParentExportReceipt(ExportReceiptMessage.PENDING)

    override suspend fun deleteParentAccount() {
        throw ApiClientException.ParentReauthRequired
    }

    override suspend fun deleteParentAccount(appleIdentityToken: String) {
        require(appleIdentityToken.isNotBlank())
    }

    override suspend fun createManagedTask(
        title: String,
        points: Int,
        childIds: List<String>,
        idempotencyKey: String,
    ): ParentDashboardSnapshot {
        val task = ParentManagedTask(
            id = UUID.randomUUID().toString(),
            title = title,
            icon = "⭐️",
            points = points,
            assigneeCount = maxOf(childIds.size, 1),
        )
        createdTasks += task
        snapshot = snapshot.copy(managedTasks = listOf(task) + snapshot.managedTasks)
        return snapshot
    }

    override suspend fun archiveManagedTask(id: String): ParentDashboardSnapshot {
        snapshot = snapshot.copy(managedTasks = snapshot.managedTasks.filterNot { it.id == id })
        return snapshot
    }

    override suspend fun createManagedReward(
        title: String,
        price: Int,
        idempotencyKey: String,
    ): ParentDashboardSnapshot {
        val reward = ParentManagedReward(
            id = UUID.randomUUID().toString(),
            title = title,
            icon = "🎁",
            price = price,
        )
        snapshot = snapshot.copy(managedRewards = listOf(reward) + snapshot.managedRewards)
        return snapshot
    }

    override suspend fun archiveManagedReward(id: String): ParentDashboardSnapshot {
        snapshot = snapshot.copy(managedRewards = snapshot.managedRewards.filterNot { it.id == id })
        return snapshot
    }

    override suspend fun fetchPhotoUrl(photoId: String): String? =
        "https://example.invalid/$photoId.jpg"

    private fun ParentDashboardSnapshot.removingApproval(
        id: String,
        approved: Boolean,
    ): ParentDashboardSnapshot {
        val sections = approvalSections.mapNotNull { section ->
            val remaining = section.items.filterNot { it.id == id }
            if (remaining.isEmpty()) null else section.copy(items = remaining)
        }
        val children = todayChildren.map { child ->
            child.copy(
                tasks = child.tasks.map { task ->
                    if (task.id != id) {
                        task
                    } else {
                        task.copy(
                            status = if (approved) {
                                ParentTaskStatus.APPROVED
                            } else {
                                ParentTaskStatus.OPEN_REDO
                            },
                        )
                    }
                },
            )
        }
        return copy(
            todayChildren = children,
            approvalSections = sections,
            lastSyncedAt = Instant.now(),
        )
    }

    private fun initialSnapshot(): ParentDashboardSnapshot {
        val now = Instant.now()
        val photoOne = ParentPhotoAsset(id = "photo-kamer", status = "ready")
        val photoTwo = ParentPhotoAsset(id = "photo-tafel", status = "ready")

        return ParentDashboardSnapshot(
            todayChildren = listOf(
                ParentTodayChildSnapshot(
                    id = "child-sam",
                    displayName = "Sam",
                    avatar = "🦊",
                    balancePoints = 34,
                    tasks = listOf(
                        ParentTaskSnapshot(
                            id = "instance-kamer",
                            title = "Kamer opruimen",
                            icon = "🧹",
                            status = ParentTaskStatus.SUBMITTED,
                            points = 12,
                            submittedAt = now.minusSeconds(3_600),
                            photoAsset = photoOne,
                            photoStatus = "ready",
                        ),
                        ParentTaskSnapshot(
                            id = "instance-tafel",
                            title = "Tafel dekken",
                            icon = "🍽️",
                            status = ParentTaskStatus.SUBMITTED,
                            points = 8,
                            submittedAt = now.minusSeconds(5_400),
                            photoAsset = photoTwo,
                            photoStatus = "ready",
                        ),
                        ParentTaskSnapshot(
                            id = "instance-bed",
                            title = "Bed opmaken",
                            icon = "🛏️",
                            status = ParentTaskStatus.OPEN,
                            points = 6,
                            submittedAt = null,
                            photoAsset = null,
                        ),
                    ),
                ),
                ParentTodayChildSnapshot(
                    id = "child-noor",
                    displayName = "Noor",
                    avatar = "🐼",
                    balancePoints = 52,
                    tasks = listOf(
                        ParentTaskSnapshot(
                            id = "instance-huiswerk",
                            title = "Wiskunde afmaken",
                            icon = "📚",
                            status = ParentTaskStatus.SUBMITTED,
                            points = 10,
                            submittedAt = now.minusSeconds(1_800),
                            photoAsset = null,
                        ),
                    ),
                ),
            ),
            approvalSections = listOf(
                ApprovalQueueSection(
                    id = "queue-child-sam",
                    childId = "child-sam",
                    childName = "Sam",
                    childAvatar = "🦊",
                    items = listOf(
                        ApprovalQueueItem(
                            id = "instance-tafel",
                            childId = "child-sam",
                            childName = "Sam",
                            childAvatar = "🦊",
                            title = "Tafel dekken",
                            icon = "🍽️",
                            submittedAt = now.minusSeconds(5_400),
                            points = 8,
                            photoAsset = photoTwo,
                            photoStatus = "ready",
                        ),
                        ApprovalQueueItem(
                            id = "instance-kamer",
                            childId = "child-sam",
                            childName = "Sam",
                            childAvatar = "🦊",
                            title = "Kamer opruimen",
                            icon = "🧹",
                            submittedAt = now.minusSeconds(3_600),
                            points = 12,
                            photoAsset = photoOne,
                            photoStatus = "ready",
                        ),
                    ),
                ),
                ApprovalQueueSection(
                    id = "queue-child-noor",
                    childId = "child-noor",
                    childName = "Noor",
                    childAvatar = "🐼",
                    items = listOf(
                        ApprovalQueueItem(
                            id = "instance-huiswerk",
                            childId = "child-noor",
                            childName = "Noor",
                            childAvatar = "🐼",
                            title = "Wiskunde afmaken",
                            icon = "📚",
                            submittedAt = now.minusSeconds(1_800),
                            points = 10,
                            photoAsset = null,
                        ),
                    ),
                ),
            ),
            managedTasks = listOf(
                ParentManagedTask("task-kamer", "Kamer opruimen", "🧹", 12, 1),
                ParentManagedTask("task-huiswerk", "Wiskunde afmaken", "📚", 10, 1),
            ),
            managedRewards = listOf(
                ParentManagedReward("reward-ijs", "IJsje", "🍦", 40),
                ParentManagedReward("reward-film", "Filmavond", "🎬", 80),
            ),
            settings = ParentSettingsSnapshot(
                soundEnabled = true,
                exportAvailable = true,
                deleteAvailable = true,
            ),
            lastSyncedAt = now,
        )
    }
}
