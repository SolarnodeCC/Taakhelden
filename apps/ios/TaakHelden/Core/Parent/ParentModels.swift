import Foundation

// MARK: - Preview-layer models
// Local view-model layer for Phase 2 parent mode. Transport DTOs live in
// ContractModels / TaakHeldenAPIClient; this layer stays UI-friendly.

enum ParentSurface: String, CaseIterable, Identifiable {
    case vandaag
    case goedkeuren
    case taken
    case beloningen
    case instellingen

    var id: String { rawValue }
}

enum ParentTaskStatus: String, Codable, Equatable {
    case open
    case submitted
    case approved
    case completed
    case openRedo = "open_redo"
}

enum ParentTaskBucket: String, CaseIterable, Identifiable, Codable {
    case open
    case awaitingApproval
    case done

    var id: String { rawValue }

    var titleKey: String {
        switch self {
        case .open:
            return "parent.bucket.open"
        case .awaitingApproval:
            return "parent.bucket.awaiting"
        case .done:
            return "parent.bucket.done"
        }
    }
}

struct ParentPhotoAsset: Identifiable, Hashable, Equatable {
    let id: String
    let previewURL: URL?
    let accessibilityLabel: String
    var status: String?

    // Privacy by design: the fullscreen viewer never exposes EXIF or location.
    var showsSensitiveMetadata: Bool { false }
}

struct ParentTaskSnapshot: Identifiable, Equatable {
    let id: String
    let title: String
    let icon: String?
    let status: ParentTaskStatus
    let points: Int
    let submittedAt: Date?
    let photoAsset: ParentPhotoAsset?
    var photoStatus: String?

    var bucket: ParentTaskBucket {
        switch status {
        case .submitted:
            return .awaitingApproval
        case .approved, .completed:
            return .done
        case .open, .openRedo:
            return .open
        }
    }

    var statusLabelKey: String {
        switch status {
        case .open:
            return "parent.task.status.open"
        case .submitted:
            return "parent.task.status.submitted"
        case .approved:
            return "parent.task.status.approved"
        case .completed:
            return "parent.task.status.completed"
        case .openRedo:
            return "parent.task.status.redo"
        }
    }
}

struct ParentTodayChildSnapshot: Identifiable, Equatable {
    let id: String
    let displayName: String
    let avatar: String
    let balancePoints: Int
    let tasks: [ParentTaskSnapshot]

    var groupedTasks: [(bucket: ParentTaskBucket, items: [ParentTaskSnapshot])] {
        ParentTaskBucket.allCases.map { bucket in
            (bucket, tasks.filter { $0.bucket == bucket })
        }
    }
}

struct ApprovalQueueItem: Identifiable, Hashable, Equatable {
    let id: String
    let childID: String
    let childName: String
    let childAvatar: String
    let title: String
    let icon: String?
    let submittedAt: Date
    let points: Int
    let photoAsset: ParentPhotoAsset?
    var photoStatus: String?

    var hasPhoto: Bool { photoAsset != nil }
    var photoReady: Bool { photoStatus == "ready" }
    var photoProcessing: Bool { photoStatus == "processing" }
}

struct ApprovalQueueSection: Identifiable, Equatable {
    let id: String
    let childID: String
    let childName: String
    let childAvatar: String
    let items: [ApprovalQueueItem]
}

struct ParentManagedTask: Identifiable, Equatable {
    let id: String
    let title: String
    let icon: String?
    let points: Int
    let assigneeCount: Int
}

struct ParentManagedReward: Identifiable, Equatable {
    let id: String
    let title: String
    let icon: String?
    let price: Int
}

struct ParentSettingsSnapshot: Codable, Equatable {
    var soundEnabled: Bool
    let exportAvailable: Bool
    let deleteAvailable: Bool
}

struct ParentExportReceipt: Codable, Equatable {
    let message: String
}

struct ParentDashboardSnapshot: Equatable {
    let todayChildren: [ParentTodayChildSnapshot]
    let approvalSections: [ApprovalQueueSection]
    var managedTasks: [ParentManagedTask]
    var managedRewards: [ParentManagedReward]
    var settings: ParentSettingsSnapshot
    var lastSyncedAt: Date

    var pendingApprovalCount: Int {
        approvalSections.reduce(into: 0) { partialResult, section in
            partialResult += section.items.count
        }
    }

    var openTaskCount: Int {
        todayChildren.reduce(into: 0) { total, child in
            total += child.tasks.filter { $0.bucket == .open }.count
        }
    }

    func approvalItem(id: String) -> ApprovalQueueItem? {
        approvalSections.flatMap(\.items).first(where: { $0.id == id })
    }
}

enum BulkApprovalValidation: Equatable {
    case allowed
    case empty
    case mixedChildren
    case photoAcknowledgementRequired
}

enum ParentApprovalRules {
    static func validateBulkApproval(
        selectedItems: [ApprovalQueueItem],
        acknowledgedPhotoReview: Bool
    ) -> BulkApprovalValidation {
        guard !selectedItems.isEmpty else {
            return .empty
        }

        let childIDs = Set(selectedItems.map(\.childID))
        guard childIDs.count == 1 else {
            return .mixedChildren
        }

        if selectedItems.contains(where: \.hasPhoto), !acknowledgedPhotoReview {
            return .photoAcknowledgementRequired
        }

        return .allowed
    }
}
