import Foundation

@Observable
final class SyncEngine {
    private let apiClient: TaakHeldenAPIClient
    private let mutationQueue: MutationQueue
    private(set) var lastSyncAt: String?
    private(set) var isSyncing = false
    private(set) var lastErrorMessage: String?

    init(apiClient: TaakHeldenAPIClient, mutationQueue: MutationQueue) {
        self.apiClient = apiClient
        self.mutationQueue = mutationQueue
    }

    @MainActor
    func syncNow() async -> [MutationQueueOutcome] {
        guard !mutationQueue.pending.isEmpty || lastSyncAt != nil else {
            return []
        }

        isSyncing = true
        defer { isSyncing = false }

        do {
            let response = try await apiClient.sync(
                since: lastSyncAt,
                mutations: mutationQueue.pending.map { $0.asSyncDTO() }
            )

            var outcomes: [MutationQueueOutcome] = []
            for result in response.results {
                let outcome = mutationQueue.outcome(for: result)
                outcomes.append(outcome)

                switch outcome {
                case .applied, .alreadyCompleted:
                    mutationQueue.remove(key: result.key)
                case .insufficientPoints, .dropped:
                    mutationQueue.remove(key: result.key)
                case .failed:
                    break
                }
            }

            lastSyncAt = response.serverTime
            lastErrorMessage = nil
            return outcomes
        } catch {
            lastErrorMessage = error.localizedDescription
            return []
        }
    }
}
