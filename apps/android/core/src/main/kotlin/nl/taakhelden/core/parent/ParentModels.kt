package nl.taakhelden.core.parent

import java.time.Instant

/**
 * UI-friendly parent-mode models.
 *
 * Transport DTOs live in `nl.taakhelden.core.api`; this layer stays shaped for the
 * screens, exactly as the iOS `ParentModels.swift` does.
 */
public enum class ParentSurface {
    VANDAAG,
    GOEDKEUREN,
    TAKEN,
    BELONINGEN,
    INSTELLINGEN,
}

public enum class ParentTaskStatus(public val wire: String) {
    OPEN("open"),
    SUBMITTED("submitted"),
    APPROVED("approved"),
    COMPLETED("completed"),
    OPEN_REDO("open_redo"),
    ;

    public companion object {
        public fun fromWire(value: String?): ParentTaskStatus =
            entries.firstOrNull { it.wire == value } ?: OPEN
    }
}

public enum class ParentTaskBucket {
    OPEN,
    AWAITING_APPROVAL,
    DONE,
}

public data class ParentPhotoAsset(
    val id: String,
    val previewUrl: String? = null,
    val status: String? = null,
) {
    /** Privacy by design: the fullscreen viewer never exposes EXIF or location. */
    public val showsSensitiveMetadata: Boolean get() = false
}

public data class ParentTaskSnapshot(
    val id: String,
    val title: String,
    val icon: String?,
    val status: ParentTaskStatus,
    val points: Int,
    val submittedAt: Instant?,
    val photoAsset: ParentPhotoAsset?,
    val photoStatus: String? = null,
) {
    public val bucket: ParentTaskBucket
        get() = when (status) {
            ParentTaskStatus.SUBMITTED -> ParentTaskBucket.AWAITING_APPROVAL
            ParentTaskStatus.APPROVED, ParentTaskStatus.COMPLETED -> ParentTaskBucket.DONE
            ParentTaskStatus.OPEN, ParentTaskStatus.OPEN_REDO -> ParentTaskBucket.OPEN
        }
}

public data class ParentTodayChildSnapshot(
    val id: String,
    val displayName: String,
    val avatar: String,
    val balancePoints: Int,
    val tasks: List<ParentTaskSnapshot>,
) {
    /** Always emits all three buckets, so the columns stay stable when one is empty. */
    public val groupedTasks: List<Pair<ParentTaskBucket, List<ParentTaskSnapshot>>>
        get() = ParentTaskBucket.entries.map { bucket ->
            bucket to tasks.filter { it.bucket == bucket }
        }
}

public data class ApprovalQueueItem(
    val id: String,
    val childId: String,
    val childName: String,
    val childAvatar: String,
    val title: String,
    val icon: String?,
    val submittedAt: Instant,
    val points: Int,
    val photoAsset: ParentPhotoAsset?,
    val photoStatus: String? = null,
) {
    public val hasPhoto: Boolean get() = photoAsset != null
    public val photoReady: Boolean get() = photoStatus == "ready"
    public val photoProcessing: Boolean get() = photoStatus == "processing"
}

public data class ApprovalQueueSection(
    val id: String,
    val childId: String,
    val childName: String,
    val childAvatar: String,
    val items: List<ApprovalQueueItem>,
)

public data class ParentManagedTask(
    val id: String,
    val title: String,
    val icon: String?,
    val points: Int,
    val assigneeCount: Int,
)

public data class ParentManagedReward(
    val id: String,
    val title: String,
    val icon: String?,
    val price: Int,
)

public data class ParentSettingsSnapshot(
    val soundEnabled: Boolean,
    val exportAvailable: Boolean,
    val deleteAvailable: Boolean,
)

public data class ParentExportReceipt(
    val message: ExportReceiptMessage,
    val downloadUrl: String? = null,
)

/** Which export outcome to render; the copy itself lives in the string catalog. */
public enum class ExportReceiptMessage {
    READY,
    PENDING,
    FAILED,
}

public data class ParentDashboardSnapshot(
    val todayChildren: List<ParentTodayChildSnapshot>,
    val approvalSections: List<ApprovalQueueSection>,
    val managedTasks: List<ParentManagedTask>,
    val managedRewards: List<ParentManagedReward>,
    val settings: ParentSettingsSnapshot,
    val lastSyncedAt: Instant,
) {
    public val pendingApprovalCount: Int
        get() = approvalSections.sumOf { it.items.size }

    public val openTaskCount: Int
        get() = todayChildren.sumOf { child ->
            child.tasks.count { it.bucket == ParentTaskBucket.OPEN }
        }

    public fun approvalItem(id: String?): ApprovalQueueItem? {
        if (id == null) return null
        return approvalSections.asSequence().flatMap { it.items }.firstOrNull { it.id == id }
    }
}

public enum class BulkApprovalValidation {
    ALLOWED,
    EMPTY,
    MIXED_CHILDREN,
    PHOTO_ACKNOWLEDGEMENT_REQUIRED,
}

public object ParentApprovalRules {
    /**
     * Bulk approve is deliberately narrow:
     *  - one child at a time, so a parent never rubber-stamps across siblings;
     *  - photos need an explicit acknowledgement, because approving a photo unseen is
     *    the one action in the app a parent cannot take back.
     */
    public fun validateBulkApproval(
        selectedItems: List<ApprovalQueueItem>,
        acknowledgedPhotoReview: Boolean,
    ): BulkApprovalValidation {
        if (selectedItems.isEmpty()) return BulkApprovalValidation.EMPTY

        val childIds = selectedItems.map { it.childId }.toSet()
        if (childIds.size != 1) return BulkApprovalValidation.MIXED_CHILDREN

        if (selectedItems.any { it.hasPhoto } && !acknowledgedPhotoReview) {
            return BulkApprovalValidation.PHOTO_ACKNOWLEDGEMENT_REQUIRED
        }

        return BulkApprovalValidation.ALLOWED
    }
}
