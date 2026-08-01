import XCTest
@testable import TaakHelden

final class MutationQueueTests: XCTestCase {
    func testStableIdempotencyKeySurvivesReload() {
        let store = InMemoryMutationQueueStore()
        let queue = MutationQueue(store: store)
        let mutation = QueuedMutation(kind: .complete, targetID: "inst-1", key: "stable-key")
        queue.enqueue(mutation)

        let reloaded = MutationQueue(store: store)
        XCTAssertEqual(reloaded.mutation(forKey: "stable-key")?.targetID, "inst-1")
    }

    func testTaskAlreadyCompletedIsTreatedAsSuccess() {
        let queue = MutationQueue(store: InMemoryMutationQueueStore())
        let outcome = queue.outcome(
            for: SyncResultDTO(
                key: "k1",
                status: "rejected",
                points: nil,
                newBalance: nil,
                code: "TASK_ALREADY_COMPLETED",
                message: nil
            )
        )
        XCTAssertEqual(outcome, .alreadyCompleted)
    }

    func testInsufficientPointsDropsMutation() {
        let store = InMemoryMutationQueueStore()
        let queue = MutationQueue(store: store)
        queue.enqueue(QueuedMutation(kind: .redeem, targetID: "reward-1", key: "k2"))

        let outcome = queue.outcome(
            for: SyncResultDTO(
                key: "k2",
                status: "rejected",
                points: nil,
                newBalance: nil,
                code: "INSUFFICIENT_POINTS",
                message: "Niet genoeg punten"
            )
        )
        XCTAssertEqual(outcome, .insufficientPoints)
        queue.remove(key: "k2")
        XCTAssertTrue(queue.pending.isEmpty)
    }

    func testPartialBatchKeepsUnhandledMutations() {
        let store = InMemoryMutationQueueStore()
        let queue = MutationQueue(store: store)
        queue.enqueue(QueuedMutation(kind: .complete, targetID: "a", key: "k-applied"))
        queue.enqueue(QueuedMutation(kind: .complete, targetID: "b", key: "k-failed"))

        queue.remove(key: "k-applied")
        XCTAssertEqual(queue.pending.count, 1)
        XCTAssertEqual(queue.pending.first?.key, "k-failed")
    }

    func testUndoWindowExpiredMapsToCorrectOutcome() {
        let queue = MutationQueue(store: InMemoryMutationQueueStore())
        let outcome = queue.outcome(
            for: SyncResultDTO(
                key: "undo-k1",
                status: "rejected",
                points: nil,
                newBalance: nil,
                code: "UNDO_WINDOW_EXPIRED",
                message: "Het terugdraaivenster is gesloten."
            )
        )
        XCTAssertEqual(outcome, .undoWindowExpired)
    }

    func testUndoMutationUsesStableIdempotencyKey() {
        let store = InMemoryMutationQueueStore()
        let queue = MutationQueue(store: store)
        let key = "undo:inst-abc"
        queue.enqueue(QueuedMutation(kind: .undo, targetID: "inst-abc", key: key))

        let reloaded = MutationQueue(store: store)
        XCTAssertEqual(reloaded.mutation(forKey: key)?.kind, .undo)
        XCTAssertEqual(reloaded.mutation(forKey: key)?.targetID, "inst-abc")
    }
}
