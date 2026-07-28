import Foundation

// MARK: - Preview-layer models
// These parent-mode types are the local view-model layer for Phase 2.
// They will be replaced by generated Swift OpenAPI types once the codegen
// pipeline from packages/shared lands on macOS CI.

protocol APIClient: AnyObject {
    func fetchWelcomeContext() async throws -> WelcomeContext
    func resolveFamilyCode(_ code: String) async throws -> FamilyCodeLookup
    func pairChild(request: ChildPairingRequest) async throws -> ChildSession
    func fetchParentDashboard() async throws -> ParentDashboardSnapshot
    func approveApproval(id: String, idempotencyKey: String) async throws -> ParentDashboardSnapshot
    func sendRedo(id: String, note: String, idempotencyKey: String) async throws -> ParentDashboardSnapshot
    func updateParentSettings(soundEnabled: Bool) async throws -> ParentSettingsSnapshot
    func requestParentDataExport() async throws -> ParentExportReceipt
    func deleteParentAccount() async throws
}

struct WelcomeContext {
    let familyPitch: String
}

struct FamilyCodeLookup: Equatable {
    let familyName: String
    let children: [ChildProfileSummary]
}

struct ChildProfileSummary: Identifiable, Equatable {
    let id: String
    let displayName: String
    let avatar: String
    let ageBand: ChildAgeBand
}

struct ChildPairingRequest: Equatable {
    let familyCode: String
    let childID: String
    let pin: String
    let ageBand: ChildAgeBand
}

struct ChildSession: Equatable {
    let childID: String
    let displayName: String
    let avatar: String
    let ageBand: ChildAgeBand
    let accessToken: String
    let refreshToken: String
}

enum ContractSource {
    static let bundledSnapshotPath = "apps/ios/openapi/openapi.json"
    static let upstreamSnapshotPath = "docs/openapi/taakhelden-core-v1.json"
    static let contractVersionHeader = "2"
}

final class PreviewAPIClient: APIClient {
    private var dashboard = PreviewParentData.dashboard

    func fetchWelcomeContext() async throws -> WelcomeContext {
        WelcomeContext(familyPitch: "Samen taken doen voelt lichter als je kleine helden ermee kunnen groeien.")
    }

    func resolveFamilyCode(_ code: String) async throws -> FamilyCodeLookup {
        let normalized = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard normalized.count == 6 else {
            throw APIClientError.invalidFamilyCode
        }

        return FamilyCodeLookup(
            familyName: "Familie Vermeer",
            children: [
                ChildProfileSummary(id: "child-sam", displayName: "Sam", avatar: "🦊", ageBand: .mid),
                ChildProfileSummary(id: "child-noor", displayName: "Noor", avatar: "🐼", ageBand: .teen),
            ]
        )
    }

    func pairChild(request: ChildPairingRequest) async throws -> ChildSession {
        guard request.pin.count == 4 else {
            throw APIClientError.invalidPin
        }

        return ChildSession(
            childID: request.childID,
            displayName: request.childID == "child-noor" ? "Noor" : "Sam",
            avatar: request.childID == "child-noor" ? "🐼" : "🦊",
            ageBand: request.childID == "child-noor" ? .teen : .mid,
            accessToken: "preview-child-access",
            refreshToken: "preview-child-refresh"
        )
    }

    func fetchParentDashboard() async throws -> ParentDashboardSnapshot {
        dashboard
    }

    func approveApproval(id: String, idempotencyKey: String) async throws -> ParentDashboardSnapshot {
        dashboard = dashboard.removingApproval(id: id, markingTaskAsApproved: true)
        return dashboard
    }

    func sendRedo(id: String, note: String, idempotencyKey: String) async throws -> ParentDashboardSnapshot {
        guard note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false else {
            throw APIClientError.invalidParentNote
        }
        dashboard = dashboard.removingApproval(id: id, markingTaskAsApproved: false)
        return dashboard
    }

    func updateParentSettings(soundEnabled: Bool) async throws -> ParentSettingsSnapshot {
        dashboard = dashboard.updatingSettings(soundEnabled: soundEnabled)
        return dashboard.settings
    }

    func requestParentDataExport() async throws -> ParentExportReceipt {
        ParentExportReceipt(message: "We zetten een export klaar en laten je dat binnen de ouderpoort weten.")
    }

    func deleteParentAccount() async throws {
        dashboard = PreviewParentData.dashboard
    }
}

enum APIClientError: LocalizedError {
    case invalidFamilyCode
    case invalidPin
    case invalidParentNote
    case sessionMissing

    var errorDescription: String? {
        switch self {
        case .invalidFamilyCode:
            return "Die gezinscode lijkt nog niet compleet."
        case .invalidPin:
            return "Die pincode mist nog een paar cijfers."
        case .invalidParentNote:
            return "Schrijf nog even een korte, positieve notitie."
        case .sessionMissing:
            return "Je sessie is verlopen. Koppel dit toestel opnieuw."
        }
    }
}

enum IdempotencyKey {
    static func forApproval(instanceID: String) -> String {
        "approve-\(instanceID)-\(UUID().uuidString)"
    }

    static func forRedo(instanceID: String) -> String {
        "redo-\(instanceID)-\(UUID().uuidString)"
    }
}

private enum PreviewParentData {
    static var dashboard: ParentDashboardSnapshot {
        let now = Date()
        let photoOne = ParentPhotoAsset(id: "photo-kamer", previewURL: URL(string: "https://example.invalid/photo-kamer.jpg"), accessibilityLabel: "Foto van de opgeruimde kamer")
        let photoTwo = ParentPhotoAsset(id: "photo-tafel", previewURL: URL(string: "https://example.invalid/photo-tafel.jpg"), accessibilityLabel: "Foto van de gedekte tafel")

        return ParentDashboardSnapshot(
            todayChildren: [
                ParentTodayChildSnapshot(id: "child-sam", displayName: "Sam", avatar: "🦊", balancePoints: 34, tasks: [
                    ParentTaskSnapshot(id: "instance-kamer", title: "Kamer opruimen", icon: "🧹", status: .submitted, points: 12, submittedAt: now.addingTimeInterval(-3_600), photoAsset: photoOne),
                    ParentTaskSnapshot(id: "instance-tafel", title: "Tafel dekken", icon: "🍽️", status: .submitted, points: 8, submittedAt: now.addingTimeInterval(-5_400), photoAsset: photoTwo),
                    ParentTaskSnapshot(id: "instance-bed", title: "Bed opmaken", icon: "🛏️", status: .open, points: 6, submittedAt: nil, photoAsset: nil),
                ]),
                ParentTodayChildSnapshot(id: "child-noor", displayName: "Noor", avatar: "🐼", balancePoints: 52, tasks: [
                    ParentTaskSnapshot(id: "instance-fiets", title: "Fiets in de schuur zetten", icon: "🚲", status: .completed, points: 5, submittedAt: now.addingTimeInterval(-7_200), photoAsset: nil),
                    ParentTaskSnapshot(id: "instance-huiswerk", title: "Wiskunde afmaken", icon: "📚", status: .submitted, points: 10, submittedAt: now.addingTimeInterval(-1_800), photoAsset: nil),
                ]),
            ],
            approvalSections: [
                ApprovalQueueSection(id: "queue-child-sam", childID: "child-sam", childName: "Sam", childAvatar: "🦊", items: [
                    ApprovalQueueItem(id: "instance-tafel", childID: "child-sam", childName: "Sam", childAvatar: "🦊", title: "Tafel dekken", icon: "🍽️", submittedAt: now.addingTimeInterval(-5_400), points: 8, photoAsset: photoTwo),
                    ApprovalQueueItem(id: "instance-kamer", childID: "child-sam", childName: "Sam", childAvatar: "🦊", title: "Kamer opruimen", icon: "🧹", submittedAt: now.addingTimeInterval(-3_600), points: 12, photoAsset: photoOne),
                ]),
                ApprovalQueueSection(id: "queue-child-noor", childID: "child-noor", childName: "Noor", childAvatar: "🐼", items: [
                    ApprovalQueueItem(id: "instance-huiswerk", childID: "child-noor", childName: "Noor", childAvatar: "🐼", title: "Wiskunde afmaken", icon: "📚", submittedAt: now.addingTimeInterval(-1_800), points: 10, photoAsset: nil),
                ]),
            ],
            settings: ParentSettingsSnapshot(soundEnabled: true, exportAvailable: true, deleteAvailable: true),
            lastSyncedAt: now
        )
    }
}

private extension ParentDashboardSnapshot {
    func removingApproval(id: String, markingTaskAsApproved: Bool) -> ParentDashboardSnapshot {
        let updatedSections = approvalSections.compactMap { section -> ApprovalQueueSection? in
            let remaining = section.items.filter { $0.id != id }
            guard !remaining.isEmpty else { return nil }
            return ApprovalQueueSection(id: section.id, childID: section.childID, childName: section.childName, childAvatar: section.childAvatar, items: remaining)
        }
        let updatedChildren = todayChildren.map { child in
            let tasks = child.tasks.map { task in
                guard task.id == id else { return task }
                return ParentTaskSnapshot(id: task.id, title: task.title, icon: task.icon, status: markingTaskAsApproved ? .approved : .openRedo, points: task.points, submittedAt: task.submittedAt, photoAsset: task.photoAsset)
            }
            return ParentTodayChildSnapshot(id: child.id, displayName: child.displayName, avatar: child.avatar, balancePoints: child.balancePoints, tasks: tasks)
        }
        return ParentDashboardSnapshot(todayChildren: updatedChildren, approvalSections: updatedSections, settings: settings, lastSyncedAt: .now)
    }

    func updatingSettings(soundEnabled: Bool) -> ParentDashboardSnapshot {
        ParentDashboardSnapshot(todayChildren: todayChildren, approvalSections: approvalSections, settings: ParentSettingsSnapshot(soundEnabled: soundEnabled, exportAvailable: settings.exportAvailable, deleteAvailable: settings.deleteAvailable), lastSyncedAt: .now)
    }
}
