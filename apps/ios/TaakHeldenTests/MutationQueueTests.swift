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
}
