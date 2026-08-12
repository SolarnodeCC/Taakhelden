package nl.taakhelden.core

import nl.taakhelden.core.api.SyncResultDTO
import nl.taakhelden.core.sync.InMemoryMutationQueueStore
import nl.taakhelden.core.sync.MutationQueue
import nl.taakhelden.core.sync.MutationQueueOutcome
import nl.taakhelden.core.sync.QueuedMutation
import nl.taakhelden.core.sync.QueuedMutationKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MutationQueueTest {

    @Test
    fun `stable idempotency key survives a reload`() {
        val store = InMemoryMutationQueueStore()
        val queue = MutationQueue(store)
        queue.enqueue(
            QueuedMutation(
                key = "stable-key",
                kind = QueuedMutationKind.COMPLETE,
                targetId = "inst-1",
            ),
        )

        val reloaded = MutationQueue(store)
        assertEquals("inst-1", reloaded.mutation("stable-key")?.targetId)
    }

    @Test
    fun `task already completed is treated as success`() {
        val queue = MutationQueue(InMemoryMutationQueueStore())
        val outcome = queue.outcome(
            SyncResultDTO(key = "k1", status = "rejected", code = "TASK_ALREADY_COMPLETED"),
        )
        assertEquals(MutationQueueOutcome.AlreadyCompleted, outcome)
    }

    @Test
    fun `insufficient points drops the mutation`() {
        val store = InMemoryMutationQueueStore()
        val queue = MutationQueue(store)
        queue.enqueue(
            QueuedMutation(key = "k2", kind = QueuedMutationKind.REDEEM, targetId = "reward-1"),
        )

        val outcome = queue.outcome(
            SyncResultDTO(
                key = "k2",
                status = "rejected",
                code = "INSUFFICIENT_POINTS",
                message = "Niet genoeg punten",
            ),
        )
        assertEquals(MutationQueueOutcome.InsufficientPoints, outcome)
        queue.remove("k2")
        assertTrue(queue.pending.value.isEmpty())
    }

    @Test
    fun `a partial batch keeps unhandled mutations queued`() {
        val store = InMemoryMutationQueueStore()
        val queue = MutationQueue(store)
        queue.enqueue(
            QueuedMutation(key = "k-applied", kind = QueuedMutationKind.COMPLETE, targetId = "a"),
        )
        queue.enqueue(
            QueuedMutation(key = "k-failed", kind = QueuedMutationKind.COMPLETE, targetId = "b"),
        )

        queue.remove("k-applied")
        assertEquals(1, queue.pending.value.size)
        assertEquals("k-failed", queue.pending.value.first().key)
    }

    @Test
    fun `undo window expired maps to its own outcome`() {
        val queue = MutationQueue(InMemoryMutationQueueStore())
        val outcome = queue.outcome(
            SyncResultDTO(
                key = "undo-k1",
                status = "rejected",
                code = "UNDO_WINDOW_EXPIRED",
                message = "Het terugdraaivenster is gesloten.",
            ),
        )
        assertEquals(MutationQueueOutcome.UndoWindowExpired, outcome)
    }

    @Test
    fun `undo mutation uses a stable idempotency key`() {
        val store = InMemoryMutationQueueStore()
        val queue = MutationQueue(store)
        val key = "undo:inst-abc"
        queue.enqueue(
            QueuedMutation(key = key, kind = QueuedMutationKind.UNDO, targetId = "inst-abc"),
        )

        val reloaded = MutationQueue(store)
        assertEquals(QueuedMutationKind.UNDO, reloaded.mutation(key)?.kind)
        assertEquals("inst-abc", reloaded.mutation(key)?.targetId)
    }

    @Test
    fun `each mutation kind maps onto its sync op`() {
        assertEquals(
            "complete",
            QueuedMutation(kind = QueuedMutationKind.COMPLETE, targetId = "i").asSyncDto().op,
        )
        assertEquals(
            "undo",
            QueuedMutation(kind = QueuedMutationKind.UNDO, targetId = "i").asSyncDto().op,
        )

        val redeem = QueuedMutation(kind = QueuedMutationKind.REDEEM, targetId = "r").asSyncDto()
        assertEquals("redeem", redeem.op)
        // A redeem targets a reward, never an instance — mixing them up would book the
        // points against the wrong entity.
        assertEquals("r", redeem.rewardId)
        assertEquals(null, redeem.instanceId)

        val attach = QueuedMutation(
            kind = QueuedMutationKind.ATTACH_PHOTO,
            targetId = "i",
            photoId = "p",
        ).asSyncDto()
        assertEquals("attach_photo", attach.op)
        assertEquals("p", attach.photoId)
    }
}
