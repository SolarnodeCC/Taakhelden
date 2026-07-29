import Foundation

// MARK: - Parent-mode API surface
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
    func deleteParentAccount(appleIdentityToken: String) async throws
    func createManagedTask(title: String, points: Int, childIDs: [String], idempotencyKey: String) async throws -> ParentDashboardSnapshot
    func archiveManagedTask(id: String) async throws -> ParentDashboardSnapshot
    func createManagedReward(title: String, price: Int, idempotencyKey: String) async throws -> ParentDashboardSnapshot
    func archiveManagedReward(id: String) async throws -> ParentDashboardSnapshot
    func fetchPhotoURL(photoID: String) async throws -> URL?
}

extension APIClient {
    func deleteParentAccount(appleIdentityToken: String) async throws {
        try await deleteParentAccount()
    }

    func createManagedTask(title: String, points: Int, childIDs: [String], idempotencyKey: String) async throws -> ParentDashboardSnapshot {
        try await fetchParentDashboard()
    }

    func archiveManagedTask(id: String) async throws -> ParentDashboardSnapshot {
        try await fetchParentDashboard()
    }

    func createManagedReward(title: String, price: Int, idempotencyKey: String) async throws -> ParentDashboardSnapshot {
        try await fetchParentDashboard()
    }

    func archiveManagedReward(id: String) async throws -> ParentDashboardSnapshot {
        try await fetchParentDashboard()
    }

    func fetchPhotoURL(photoID: String) async throws -> URL? { nil }
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
    private let lock = NSLock()
    private var _dashboard = PreviewParentData.dashboard

    private func withDashboard<T>(_ body: (inout ParentDashboardSnapshot) -> T) -> T {
        lock.lock()
        defer { lock.unlock() }
        return body(&_dashboard)
    }

    private var dashboard: ParentDashboardSnapshot {
        lock.withLock { _dashboard }
    }

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
        withDashboard { d in
            d = d.removingApproval(id: id, markingTaskAsApproved: true)
            return d
        }
    }

    func sendRedo(id: String, note: String, idempotencyKey: String) async throws -> ParentDashboardSnapshot {
        guard note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false else {
            throw APIClientError.invalidParentNote
        }
        return withDashboard { d in
            d = d.removingApproval(id: id, markingTaskAsApproved: false)
            return d
        }
    }

    func updateParentSettings(soundEnabled: Bool) async throws -> ParentSettingsSnapshot {
        withDashboard { d in
            d = d.updatingSettings(soundEnabled: soundEnabled)
            return d.settings
        }
    }

    func requestParentDataExport() async throws -> ParentExportReceipt {
        ParentExportReceipt(message: "We zetten een export klaar en laten je dat binnen de ouderpoort weten.")
    }

    func deleteParentAccount() async throws {
        withDashboard { d in d = PreviewParentData.dashboard }
    }

    func deleteParentAccount(appleIdentityToken: String) async throws {
        try await deleteParentAccount()
    }

    func createManagedTask(title: String, points: Int, childIDs: [String], idempotencyKey: String) async throws -> ParentDashboardSnapshot {
        withDashboard { d in
            var tasks = d.managedTasks
            tasks.insert(
                ParentManagedTask(id: UUID().uuidString, title: title, icon: "⭐️", points: points, assigneeCount: max(childIDs.count, 1)),
                at: 0
            )
            d = ParentDashboardSnapshot(
                todayChildren: d.todayChildren,
                approvalSections: d.approvalSections,
                managedTasks: tasks,
                managedRewards: d.managedRewards,
                settings: d.settings,
                lastSyncedAt: .now
            )
            return d
        }
    }

    func archiveManagedTask(id: String) async throws -> ParentDashboardSnapshot {
        withDashboard { d in
            d = ParentDashboardSnapshot(
                todayChildren: d.todayChildren,
                approvalSections: d.approvalSections,
                managedTasks: d.managedTasks.filter { $0.id != id },
                managedRewards: d.managedRewards,
                settings: d.settings,
                lastSyncedAt: .now
            )
            return d
        }
    }

    func createManagedReward(title: String, price: Int, idempotencyKey: String) async throws -> ParentDashboardSnapshot {
        withDashboard { d in
            var rewards = d.managedRewards
            rewards.insert(ParentManagedReward(id: UUID().uuidString, title: title, icon: "🎁", price: price), at: 0)
            d = ParentDashboardSnapshot(
                todayChildren: d.todayChildren,
                approvalSections: d.approvalSections,
                managedTasks: d.managedTasks,
                managedRewards: rewards,
                settings: d.settings,
                lastSyncedAt: .now
            )
            return d
        }
    }

    func archiveManagedReward(id: String) async throws -> ParentDashboardSnapshot {
        withDashboard { d in
            d = ParentDashboardSnapshot(
                todayChildren: d.todayChildren,
                approvalSections: d.approvalSections,
                managedTasks: d.managedTasks,
                managedRewards: d.managedRewards.filter { $0.id != id },
                settings: d.settings,
                lastSyncedAt: .now
            )
            return d
        }
    }
}

enum APIClientError: LocalizedError, Equatable {
    case invalidFamilyCode
    case invalidPin
    case invalidParentNote
    case sessionMissing
    case parentSessionMissing
    case parentReauthRequired

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
        case .parentSessionMissing:
            return "Log even in met je ouderaccount om goed te keuren of te beheren."
        case .parentReauthRequired:
            return "Bevestig opnieuw met Apple om het account te verwijderen."
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

    static func forTaskCreate() -> String {
        "task-create-\(UUID().uuidString)"
    }

    static func forRewardCreate() -> String {
        "reward-create-\(UUID().uuidString)"
    }
}

private enum PreviewParentData {
    static var dashboard: ParentDashboardSnapshot {
        let now = Date()
        let photoOne = ParentPhotoAsset(id: "photo-kamer", previewURL: URL(string: "https://example.invalid/photo-kamer.jpg"), accessibilityLabel: "Foto van de opgeruimde kamer", status: "ready")
        let photoTwo = ParentPhotoAsset(id: "photo-tafel", previewURL: URL(string: "https://example.invalid/photo-tafel.jpg"), accessibilityLabel: "Foto van de gedekte tafel", status: "ready")

        return ParentDashboardSnapshot(
            todayChildren: [
                ParentTodayChildSnapshot(id: "child-sam", displayName: "Sam", avatar: "🦊", balancePoints: 34, tasks: [
                    ParentTaskSnapshot(id: "instance-kamer", title: "Kamer opruimen", icon: "🧹", status: .submitted, points: 12, submittedAt: now.addingTimeInterval(-3_600), photoAsset: photoOne, photoStatus: "ready"),
                    ParentTaskSnapshot(id: "instance-tafel", title: "Tafel dekken", icon: "🍽️", status: .submitted, points: 8, submittedAt: now.addingTimeInterval(-5_400), photoAsset: photoTwo, photoStatus: "ready"),
                    ParentTaskSnapshot(id: "instance-bed", title: "Bed opmaken", icon: "🛏️", status: .open, points: 6, submittedAt: nil, photoAsset: nil, photoStatus: nil),
                ]),
                ParentTodayChildSnapshot(id: "child-noor", displayName: "Noor", avatar: "🐼", balancePoints: 52, tasks: [
                    ParentTaskSnapshot(id: "instance-fiets", title: "Fiets in de schuur zetten", icon: "🚲", status: .completed, points: 5, submittedAt: now.addingTimeInterval(-7_200), photoAsset: nil, photoStatus: nil),
                    ParentTaskSnapshot(id: "instance-huiswerk", title: "Wiskunde afmaken", icon: "📚", status: .submitted, points: 10, submittedAt: now.addingTimeInterval(-1_800), photoAsset: nil, photoStatus: nil),
                ]),
            ],
            approvalSections: [
                ApprovalQueueSection(id: "queue-child-sam", childID: "child-sam", childName: "Sam", childAvatar: "🦊", items: [
                    ApprovalQueueItem(id: "instance-tafel", childID: "child-sam", childName: "Sam", childAvatar: "🦊", title: "Tafel dekken", icon: "🍽️", submittedAt: now.addingTimeInterval(-5_400), points: 8, photoAsset: photoTwo, photoStatus: "ready"),
                    ApprovalQueueItem(id: "instance-kamer", childID: "child-sam", childName: "Sam", childAvatar: "🦊", title: "Kamer opruimen", icon: "🧹", submittedAt: now.addingTimeInterval(-3_600), points: 12, photoAsset: photoOne, photoStatus: "ready"),
                ]),
                ApprovalQueueSection(id: "queue-child-noor", childID: "child-noor", childName: "Noor", childAvatar: "🐼", items: [
                    ApprovalQueueItem(id: "instance-huiswerk", childID: "child-noor", childName: "Noor", childAvatar: "🐼", title: "Wiskunde afmaken", icon: "📚", submittedAt: now.addingTimeInterval(-1_800), points: 10, photoAsset: nil, photoStatus: nil),
                ]),
            ],
            managedTasks: [
                ParentManagedTask(id: "task-kamer", title: "Kamer opruimen", icon: "🧹", points: 12, assigneeCount: 1),
                ParentManagedTask(id: "task-huiswerk", title: "Wiskunde afmaken", icon: "📚", points: 10, assigneeCount: 1),
            ],
            managedRewards: [
                ParentManagedReward(id: "reward-ijs", title: "IJsje", icon: "🍦", price: 40),
                ParentManagedReward(id: "reward-film", title: "Filmavond", icon: "🎬", price: 80),
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
                return ParentTaskSnapshot(
                    id: task.id,
                    title: task.title,
                    icon: task.icon,
                    status: markingTaskAsApproved ? .approved : .openRedo,
                    points: task.points,
                    submittedAt: task.submittedAt,
                    photoAsset: task.photoAsset,
                    photoStatus: task.photoStatus
                )
            }
            return ParentTodayChildSnapshot(id: child.id, displayName: child.displayName, avatar: child.avatar, balancePoints: child.balancePoints, tasks: tasks)
        }
        return ParentDashboardSnapshot(
            todayChildren: updatedChildren,
            approvalSections: updatedSections,
            managedTasks: managedTasks,
            managedRewards: managedRewards,
            settings: settings,
            lastSyncedAt: .now
        )
    }

    func updatingSettings(soundEnabled: Bool) -> ParentDashboardSnapshot {
        ParentDashboardSnapshot(
            todayChildren: todayChildren,
            approvalSections: approvalSections,
            managedTasks: managedTasks,
            managedRewards: managedRewards,
            settings: ParentSettingsSnapshot(soundEnabled: soundEnabled, exportAvailable: settings.exportAvailable, deleteAvailable: settings.deleteAvailable),
            lastSyncedAt: .now
        )
    }
}
