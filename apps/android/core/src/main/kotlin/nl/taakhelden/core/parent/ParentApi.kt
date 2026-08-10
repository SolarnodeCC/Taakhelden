package nl.taakhelden.core.parent

import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import nl.taakhelden.core.api.ApiClientException
import nl.taakhelden.core.api.ChildPairingRequest
import nl.taakhelden.core.api.FamilyCodeLookup
import nl.taakhelden.core.api.InstanceViewDTO
import nl.taakhelden.core.api.ParentRewardManageDTO
import nl.taakhelden.core.api.ParentTaskManageDTO
import nl.taakhelden.core.api.ParentTodayViewDTO
import nl.taakhelden.core.api.TaakHeldenApiClient
import nl.taakhelden.core.auth.AuthStore
import nl.taakhelden.core.auth.ChildSession
import nl.taakhelden.core.designsystem.AvatarCatalog
import java.time.Instant
import java.time.format.DateTimeParseException

/**
 * The parent-mode API surface, mirroring the iOS `APIClient` protocol.
 *
 * Kept as an interface so the parent store can be unit-tested against a fake without a
 * network, the same way `PreviewAPIClient` works on iOS.
 */
public interface ParentApi {
    public suspend fun resolveFamilyCode(code: String): FamilyCodeLookup
    public suspend fun pairChild(request: ChildPairingRequest): ChildSession
    public suspend fun fetchParentDashboard(): ParentDashboardSnapshot
    public suspend fun approveApproval(id: String, idempotencyKey: String): ParentDashboardSnapshot
    public suspend fun sendRedo(
        id: String,
        note: String,
        idempotencyKey: String,
    ): ParentDashboardSnapshot

    public suspend fun updateParentSettings(soundEnabled: Boolean): ParentSettingsSnapshot
    public suspend fun requestParentDataExport(): ParentExportReceipt
    public suspend fun deleteParentAccount()
    public suspend fun deleteParentAccount(appleIdentityToken: String)
    public suspend fun createManagedTask(
        title: String,
        points: Int,
        childIds: List<String>,
        idempotencyKey: String,
    ): ParentDashboardSnapshot

    public suspend fun archiveManagedTask(id: String): ParentDashboardSnapshot
    public suspend fun createManagedReward(
        title: String,
        price: Int,
        idempotencyKey: String,
    ): ParentDashboardSnapshot

    public suspend fun archiveManagedReward(id: String): ParentDashboardSnapshot
    public suspend fun fetchPhotoUrl(photoId: String): String?
}

/** Device-local preferences the parent gate toggles (child reward sound). */
public interface ParentPreferences {
    public var childSoundsEnabled: Boolean
}

public class InMemoryParentPreferences(
    override var childSoundsEnabled: Boolean = true,
) : ParentPreferences

/** Maps live HTTP DTOs onto the parent-mode view models. */
public class ParentApiAdapter(
    private val api: TaakHeldenApiClient,
    private val authStore: AuthStore,
    private val preferences: ParentPreferences = InMemoryParentPreferences(),
) : ParentApi {

    override suspend fun resolveFamilyCode(code: String): FamilyCodeLookup =
        api.resolveFamilyCode(code)

    override suspend fun pairChild(request: ChildPairingRequest): ChildSession =
        api.pairChild(request)

    override suspend fun fetchParentDashboard(): ParentDashboardSnapshot = coroutineScope {
        requireParentSession()
        // Three independent reads. Firing them in parallel keeps the dashboard's
        // time-to-first-paint at one round trip instead of three — the parent opens this
        // screen from a push and expects it to be current immediately.
        val todayTask = async { api.fetchParentToday() }
        val tasksTask = async { api.fetchParentTasks() }
        val rewardsTask = async { api.fetchParentRewards() }

        ParentDashboardMapper.map(
            today = todayTask.await(),
            managedTasks = tasksTask.await(),
            managedRewards = rewardsTask.await(),
            soundEnabled = preferences.childSoundsEnabled,
        )
    }

    override suspend fun approveApproval(
        id: String,
        idempotencyKey: String,
    ): ParentDashboardSnapshot {
        requireParentSession()
        api.approveInstance(id, idempotencyKey)
        return fetchParentDashboard()
    }

    override suspend fun sendRedo(
        id: String,
        note: String,
        idempotencyKey: String,
    ): ParentDashboardSnapshot {
        requireParentSession()
        api.redoInstance(id, note, idempotencyKey)
        return fetchParentDashboard()
    }

    override suspend fun updateParentSettings(soundEnabled: Boolean): ParentSettingsSnapshot {
        // Intentionally local-only: the child reward sound is a device preference behind
        // the parental gate, not a server notification-settings field.
        preferences.childSoundsEnabled = soundEnabled
        return ParentSettingsSnapshot(
            soundEnabled = soundEnabled,
            exportAvailable = true,
            deleteAvailable = true,
        )
    }

    override suspend fun requestParentDataExport(): ParentExportReceipt {
        requireParentSession()
        val job = api.startAccountExport()
        if (job.status == "ready" && job.downloadUrl != null) {
            return ParentExportReceipt(ExportReceiptMessage.READY, job.downloadUrl)
        }

        // Poll a few times so local/staging feels responsive; production exports finish
        // asynchronously and the parent is told to come back.
        repeat(EXPORT_POLL_ATTEMPTS) {
            delay(EXPORT_POLL_INTERVAL_MS)
            val status = api.fetchAccountExport(job.exportId)
            if (status.status == "ready" && status.downloadUrl != null) {
                return ParentExportReceipt(ExportReceiptMessage.READY, status.downloadUrl)
            }
            if (status.status == "failed") {
                return ParentExportReceipt(ExportReceiptMessage.FAILED)
            }
        }

        return ParentExportReceipt(ExportReceiptMessage.PENDING)
    }

    override suspend fun deleteParentAccount() {
        requireParentSession()
        // Apple-only accounts require a fresh identity token; the caller must go through
        // the re-auth sheet and use the overload below.
        throw ApiClientException.ParentReauthRequired
    }

    override suspend fun deleteParentAccount(appleIdentityToken: String) {
        requireParentSession()
        api.deleteAccount(appleIdentityToken)
        authStore.clearParentSession()
    }

    override suspend fun createManagedTask(
        title: String,
        points: Int,
        childIds: List<String>,
        idempotencyKey: String,
    ): ParentDashboardSnapshot {
        requireParentSession()
        api.createTask(title, points, childIds, idempotencyKey)
        return fetchParentDashboard()
    }

    override suspend fun archiveManagedTask(id: String): ParentDashboardSnapshot {
        requireParentSession()
        api.archiveTask(id)
        return fetchParentDashboard()
    }

    override suspend fun createManagedReward(
        title: String,
        price: Int,
        idempotencyKey: String,
    ): ParentDashboardSnapshot {
        requireParentSession()
        api.createReward(title, price, idempotencyKey)
        return fetchParentDashboard()
    }

    override suspend fun archiveManagedReward(id: String): ParentDashboardSnapshot {
        requireParentSession()
        api.archiveReward(id)
        return fetchParentDashboard()
    }

    override suspend fun fetchPhotoUrl(photoId: String): String? {
        requireParentSession()
        return api.fetchPhotoStatus(photoId).url
    }

    private fun requireParentSession() {
        if (authStore.parentSession == null) throw ApiClientException.ParentSessionMissing
    }

    private companion object {
        const val EXPORT_POLL_ATTEMPTS = 8
        const val EXPORT_POLL_INTERVAL_MS = 750L
    }
}

public object ParentDashboardMapper {

    public fun map(
        today: ParentTodayViewDTO,
        managedTasks: List<ParentTaskManageDTO>,
        managedRewards: List<ParentRewardManageDTO>,
        soundEnabled: Boolean,
        now: Instant = Instant.now(),
    ): ParentDashboardSnapshot {
        val children = today.children.map { child ->
            val avatar = AvatarCatalog.emojiFor(child.avatarId)
            ParentTodayChildSnapshot(
                id = child.childId,
                displayName = child.displayName,
                avatar = avatar,
                balancePoints = child.balance.balance,
                tasks = child.instances
                    .map(::mapTask)
                    .sortedBy { it.submittedAt ?: Instant.EPOCH },
            )
        }

        val approvalSections = today.children.mapNotNull { child ->
            val avatar = AvatarCatalog.emojiFor(child.avatarId)
            val items = child.instances
                .filter { it.status == "submitted" }
                .map { instance ->
                    ApprovalQueueItem(
                        id = instance.id,
                        childId = child.childId,
                        childName = child.displayName,
                        childAvatar = avatar,
                        title = instance.title,
                        icon = instance.icon,
                        submittedAt = parseDate(instance.completedAt) ?: now,
                        points = instance.points,
                        photoAsset = mapPhoto(instance),
                        photoStatus = instance.photoStatus,
                    )
                }
                .sortedBy { it.submittedAt }

            if (items.isEmpty()) {
                null
            } else {
                ApprovalQueueSection(
                    id = "queue-${child.childId}",
                    childId = child.childId,
                    childName = child.displayName,
                    childAvatar = avatar,
                    items = items,
                )
            }
        }.sortedBy { it.childName }

        return ParentDashboardSnapshot(
            todayChildren = children,
            approvalSections = approvalSections,
            managedTasks = managedTasks.map {
                ParentManagedTask(
                    id = it.id,
                    title = it.title,
                    icon = it.icon,
                    points = it.points,
                    assigneeCount = it.assignees.size,
                )
            },
            managedRewards = managedRewards.map {
                ParentManagedReward(
                    id = it.id,
                    title = it.title,
                    icon = it.icon,
                    price = it.price,
                )
            },
            settings = ParentSettingsSnapshot(
                soundEnabled = soundEnabled,
                exportAvailable = true,
                deleteAvailable = true,
            ),
            lastSyncedAt = now,
        )
    }

    private fun mapTask(instance: InstanceViewDTO): ParentTaskSnapshot = ParentTaskSnapshot(
        id = instance.id,
        title = instance.title,
        icon = instance.icon,
        status = ParentTaskStatus.fromWire(instance.status),
        points = instance.points,
        submittedAt = parseDate(instance.completedAt),
        photoAsset = mapPhoto(instance),
        photoStatus = instance.photoStatus,
    )

    private fun mapPhoto(instance: InstanceViewDTO): ParentPhotoAsset? {
        val photoId = instance.photoId ?: return null
        // The preview URL is fetched lazily when the parent opens the photo, so a
        // dashboard refresh never mints signed URLs for photos nobody looks at.
        return ParentPhotoAsset(id = photoId, previewUrl = null, status = instance.photoStatus)
    }

    /** The Worker emits ISO-8601 with or without fractional seconds; accept both. */
    private fun parseDate(value: String?): Instant? {
        if (value == null) return null
        return try {
            Instant.parse(value)
        } catch (_: DateTimeParseException) {
            null
        }
    }
}
