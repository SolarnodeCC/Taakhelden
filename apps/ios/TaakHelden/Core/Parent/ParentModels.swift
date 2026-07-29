import Foundation

// MARK: - Preview-layer models
// These types are the local view-model layer for Phase 2 parent mode.
// They will be replaced by generated Swift OpenAPI types once the codegen
// pipeline from packages/shared lands on macOS CI. Do not use these as the
// real transport layer — they intentionally diverge from wire format where
// the preview needs simplification.

enum ParentSurface: String, CaseIterable, Identifiable {
    case vandaag
    case goedkeuren
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

    var title: String {
        switch self {
        case .open:
            return "Te doen"
        case .awaitingApproval:
            return "Wacht op goedkeuring"
        case .done:
            return "Af"
        }
    }
}

struct ParentPhotoAsset: Identifiable, Hashable, Equatable {
    let id: String
    let previewURL: URL?
    let accessibilityLabel: String

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

    var statusLabel: String {
        switch status {
        case .open:
            return "Klaar om op te pakken"
        case .submitted:
            return "Wacht op goedkeuring"
        case .approved:
            return "Goedgekeurd"
        case .completed:
            return "Afgerond"
        case .openRedo:
            return "Nog even afronden"
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

    var hasPhoto: Bool { photoAsset != nil }
}

struct ApprovalQueueSection: Identifiable, Equatable {
    let id: String
    let childID: String
    let childName: String
    let childAvatar: String
    let items: [ApprovalQueueItem]
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
    var settings: ParentSettingsSnapshot
    var lastSyncedAt: Date

    var pendingApprovalCount: Int {
        approvalSections.reduce(into: 0) { partialResult, section in
            partialResult += section.items.count
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
