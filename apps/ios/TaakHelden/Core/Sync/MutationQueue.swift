import Foundation

enum QueuedMutationKind: String, Codable {
    case complete
    case undo
    case redeem
    case attachPhoto
}

struct QueuedMutation: Codable, Identifiable, Equatable {
    let id: UUID
    let key: String
    let kind: QueuedMutationKind
    let targetID: String
    let photoID: String?
    let createdAt: Date

    init(kind: QueuedMutationKind, targetID: String, photoID: String? = nil, key: String = UUID().uuidString) {
        self.id = UUID()
        self.key = key
        self.kind = kind
        self.targetID = targetID
        self.photoID = photoID
        self.createdAt = Date()
    }

    func asSyncDTO() -> SyncMutationDTO {
        switch kind {
        case .complete:
            return SyncMutationDTO(key: key, op: "complete", instanceId: targetID, rewardId: nil, photoId: nil, at: ISO8601DateFormatter().string(from: createdAt))
        case .undo:
            return SyncMutationDTO(key: key, op: "undo", instanceId: targetID, rewardId: nil, photoId: nil, at: ISO8601DateFormatter().string(from: createdAt))
        case .redeem:
            return SyncMutationDTO(key: key, op: "redeem", instanceId: nil, rewardId: targetID, photoId: nil, at: ISO8601DateFormatter().string(from: createdAt))
        case .attachPhoto:
            return SyncMutationDTO(key: key, op: "attach_photo", instanceId: targetID, rewardId: nil, photoId: photoID, at: ISO8601DateFormatter().string(from: createdAt))
        }
    }
}

enum MutationQueueOutcome: Equatable {
    case applied(newBalance: Int?)
    case alreadyCompleted
    case insufficientPoints
    /// Server rejected the undo because the 5-minute window has passed.
    case undoWindowExpired
    case dropped
    case failed(message: String)
}

protocol MutationQueueStoring {
    func load() -> [QueuedMutation]
    func save(_ mutations: [QueuedMutation])
}

final class FileMutationQueueStore: MutationQueueStoring {
    private let url: URL

    init(filename: String = "mutation-queue.json") {
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        url = directory.appendingPathComponent(filename)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    func load() -> [QueuedMutation] {
        guard let data = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder().decode([QueuedMutation].self, from: data)) ?? []
    }

    func save(_ mutations: [QueuedMutation]) {
        guard let data = try? JSONEncoder().encode(mutations) else { return }
        try? data.write(to: url, options: .atomic)
    }
}

final class InMemoryMutationQueueStore: MutationQueueStoring {
    var mutations: [QueuedMutation] = []

    func load() -> [QueuedMutation] { mutations }
    func save(_ mutations: [QueuedMutation]) { self.mutations = mutations }
}

@Observable
final class MutationQueue {
    private(set) var pending: [QueuedMutation] = []
    private let store: MutationQueueStoring

    init(store: MutationQueueStoring = InMemoryMutationQueueStore()) {
        self.store = store
        pending = store.load()
    }

    var hasPendingWork: Bool { !pending.isEmpty }

    func enqueue(_ mutation: QueuedMutation) {
        pending.append(mutation)
        persist()
    }

    func remove(key: String) {
        pending.removeAll { $0.key == key }
        persist()
    }

    func removeAll() {
        pending.removeAll()
        persist()
    }

    func mutation(forKey key: String) -> QueuedMutation? {
        pending.first { $0.key == key }
    }

    func outcome(for result: SyncResultDTO) -> MutationQueueOutcome {
        if result.status == "applied" {
            return .applied(newBalance: result.newBalance)
        }

        switch result.code {
        case "TASK_ALREADY_COMPLETED":
            return .alreadyCompleted
        case "INSUFFICIENT_POINTS":
            return .insufficientPoints
        case "UNDO_WINDOW_EXPIRED":
            return .undoWindowExpired
        default:
            return .failed(message: result.message ?? "Er ging iets mis.")
        }
    }

    private func persist() {
        store.save(pending)
    }
}
