package nl.taakhelden.core.sync

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable
import nl.taakhelden.core.api.SyncMutationDTO
import nl.taakhelden.core.api.SyncResultDTO
import nl.taakhelden.core.api.apiJson
import java.time.Instant
import java.util.UUID

public enum class QueuedMutationKind {
    COMPLETE,
    UNDO,
    REDEEM,
    ATTACH_PHOTO,
}

@Serializable
public data class QueuedMutation(
    val id: String = UUID.randomUUID().toString(),
    val key: String = UUID.randomUUID().toString(),
    val kind: QueuedMutationKind,
    val targetId: String,
    val photoId: String? = null,
    /** ISO-8601; the server uses this to order offline mutations. */
    val createdAt: String = Instant.now().toString(),
) {
    public fun asSyncDto(): SyncMutationDTO = when (kind) {
        QueuedMutationKind.COMPLETE -> SyncMutationDTO(
            key = key,
            op = "complete",
            instanceId = targetId,
            at = createdAt,
        )

        QueuedMutationKind.UNDO -> SyncMutationDTO(
            key = key,
            op = "undo",
            instanceId = targetId,
            at = createdAt,
        )

        QueuedMutationKind.REDEEM -> SyncMutationDTO(
            key = key,
            op = "redeem",
            rewardId = targetId,
            at = createdAt,
        )

        QueuedMutationKind.ATTACH_PHOTO -> SyncMutationDTO(
            key = key,
            op = "attach_photo",
            instanceId = targetId,
            photoId = photoId,
            at = createdAt,
        )
    }
}

public sealed interface MutationQueueOutcome {
    public data class Applied(val newBalance: Int?) : MutationQueueOutcome
    public data object AlreadyCompleted : MutationQueueOutcome
    public data object InsufficientPoints : MutationQueueOutcome

    /** The server rejected the undo because the 5-minute window has passed. */
    public data object UndoWindowExpired : MutationQueueOutcome
    public data object Dropped : MutationQueueOutcome
    public data class Failed(val message: String?) : MutationQueueOutcome
}

/** Persistence seam so the queue survives process death without core knowing about Android. */
public interface MutationQueueStore {
    public fun load(): List<QueuedMutation>
    public fun save(mutations: List<QueuedMutation>)
}

public class InMemoryMutationQueueStore(
    private var mutations: List<QueuedMutation> = emptyList(),
) : MutationQueueStore {
    override fun load(): List<QueuedMutation> = mutations
    override fun save(mutations: List<QueuedMutation>) {
        this.mutations = mutations
    }
}

/** JSON-file backed queue — the counterpart of the iOS `FileMutationQueueStore`. */
public class FileMutationQueueStore(private val file: java.io.File) : MutationQueueStore {
    private val serializer = kotlinx.serialization.builtins.ListSerializer(
        QueuedMutation.serializer(),
    )

    override fun load(): List<QueuedMutation> {
        if (!file.exists()) return emptyList()
        return runCatching {
            apiJson.decodeFromString(serializer, file.readText())
        }.getOrDefault(emptyList())
    }

    override fun save(mutations: List<QueuedMutation>) {
        runCatching {
            file.parentFile?.mkdirs()
            // Write-then-rename so a crash mid-write cannot truncate the queue and lose a
            // child's checked-off task.
            val scratchFile = java.io.File(file.parentFile, "${file.name}.tmp")
            scratchFile.writeText(apiJson.encodeToString(serializer, mutations))
            scratchFile.renameTo(file)
        }
    }
}

/**
 * Durable queue of ledger-affecting mutations made while offline.
 *
 * Every entry carries its own stable [QueuedMutation.key]; the server dedupes on it, so
 * replaying the queue after a dropped response can never double-award points
 * (architecture rule 2).
 */
public class MutationQueue(
    private val store: MutationQueueStore = InMemoryMutationQueueStore(),
) {
    private val _pending = MutableStateFlow(store.load())
    public val pending: StateFlow<List<QueuedMutation>> = _pending.asStateFlow()

    public val hasPendingWork: Boolean get() = _pending.value.isNotEmpty()

    public fun enqueue(mutation: QueuedMutation) {
        _pending.value = _pending.value + mutation
        persist()
    }

    public fun remove(key: String) {
        _pending.value = _pending.value.filterNot { it.key == key }
        persist()
    }

    public fun removeAll() {
        _pending.value = emptyList()
        persist()
    }

    public fun mutation(forKey: String): QueuedMutation? =
        _pending.value.firstOrNull { it.key == forKey }

    public fun outcome(result: SyncResultDTO): MutationQueueOutcome {
        if (result.status == "applied") {
            return MutationQueueOutcome.Applied(result.newBalance)
        }

        return when (result.code) {
            "TASK_ALREADY_COMPLETED" -> MutationQueueOutcome.AlreadyCompleted
            "INSUFFICIENT_POINTS" -> MutationQueueOutcome.InsufficientPoints
            "UNDO_WINDOW_EXPIRED" -> MutationQueueOutcome.UndoWindowExpired
            else -> MutationQueueOutcome.Failed(result.message)
        }
    }

    private fun persist() {
        store.save(_pending.value)
    }
}
