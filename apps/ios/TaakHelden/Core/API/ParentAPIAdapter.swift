import Foundation

/// Maps live HTTP DTOs into the Phase 2 parent-mode view models.
/// Preview models stay until OpenAPI codegen fully replaces them.
final class ParentAPIAdapter: APIClient {
    private let api: TaakHeldenAPIClient
    private let authStore: AuthStore
    private var cachedSoundEnabled: Bool

    init(api: TaakHeldenAPIClient, authStore: AuthStore, soundEnabled: Bool = AppSettings.childSoundsEnabled) {
        self.api = api
        self.authStore = authStore
        self.cachedSoundEnabled = soundEnabled
    }

    func fetchWelcomeContext() async throws -> WelcomeContext {
        WelcomeContext(familyPitch: "Samen taken doen voelt lichter als je kleine helden ermee kunnen groeien.")
    }

    func resolveFamilyCode(_ code: String) async throws -> FamilyCodeLookup {
        try await api.resolveFamilyCode(code)
    }

    func pairChild(request: ChildPairingRequest) async throws -> ChildSession {
        try await api.pairChild(request: request)
    }

    func fetchParentDashboard() async throws -> ParentDashboardSnapshot {
        try requireParentSession()
        async let todayTask = api.fetchParentToday()
        async let tasksTask = api.fetchParentTasks()
        async let rewardsTask = api.fetchParentRewards()
        let today = try await todayTask
        let tasks = try await tasksTask
        let rewards = try await rewardsTask

        let mapped = ParentDashboardMapper.map(
            today: today,
            managedTasks: tasks,
            managedRewards: rewards,
            soundEnabled: cachedSoundEnabled
        )
        return mapped
    }

    func approveApproval(id: String, idempotencyKey: String) async throws -> ParentDashboardSnapshot {
        try requireParentSession()
        _ = try await api.approveInstance(id: id, idempotencyKey: idempotencyKey)
        return try await fetchParentDashboard()
    }

    func sendRedo(id: String, note: String, idempotencyKey: String) async throws -> ParentDashboardSnapshot {
        try requireParentSession()
        _ = try await api.redoInstance(id: id, note: note, idempotencyKey: idempotencyKey)
        return try await fetchParentDashboard()
    }

    func updateParentSettings(soundEnabled: Bool) async throws -> ParentSettingsSnapshot {
        // Intentionally local-only: child reward sound is a device preference behind the
        // parental gate, not a server notification-settings field.
        cachedSoundEnabled = soundEnabled
        AppSettings.childSoundsEnabled = soundEnabled
        return ParentSettingsSnapshot(soundEnabled: soundEnabled, exportAvailable: true, deleteAvailable: true)
    }

    func requestParentDataExport() async throws -> ParentExportReceipt {
        try requireParentSession()
        let job = try await api.startAccountExport()
        if job.status == "ready", let url = job.downloadUrl {
            return ParentExportReceipt(message: String(format: String(localized: "parent.settings.export.ready"), url))
        }

        // Poll a few times for local/staging responsiveness.
        for _ in 0..<8 {
            try Task.checkCancellation()
            try await Task.sleep(nanoseconds: 750_000_000)
            try Task.checkCancellation()
            let status = try await api.fetchAccountExport(id: job.exportId)
            if status.status == "ready", let url = status.downloadUrl {
                return ParentExportReceipt(message: String(format: String(localized: "parent.settings.export.ready"), url))
            }
            if status.status == "failed" {
                return ParentExportReceipt(message: String(localized: "parent.settings.export.failed"))
            }
        }

        return ParentExportReceipt(message: String(localized: "parent.settings.export.pending"))
    }

    func deleteParentAccount() async throws {
        try requireParentSession()
        // SIWA re-auth is required for Apple-only accounts; callers should pass a fresh token.
        // When only a parent JWT is present without a new Apple token, attempt delete with empty
        // body is rejected by the API — surface a clear error via ParentModeStore SIWA sheet.
        throw APIClientError.parentReauthRequired
    }

    func deleteParentAccount(appleIdentityToken: String) async throws {
        try requireParentSession()
        _ = try await api.deleteAccount(appleIdentityToken: appleIdentityToken)
        authStore.clearParentSession()
    }

    func createManagedTask(title: String, points: Int, childIDs: [String], idempotencyKey: String) async throws -> ParentDashboardSnapshot {
        try requireParentSession()
        _ = try await api.createTask(
            title: title,
            points: points,
            assignees: childIDs,
            idempotencyKey: idempotencyKey
        )
        return try await fetchParentDashboard()
    }

    func archiveManagedTask(id: String) async throws -> ParentDashboardSnapshot {
        try requireParentSession()
        try await api.archiveTask(id: id)
        return try await fetchParentDashboard()
    }

    func createManagedReward(title: String, price: Int, idempotencyKey: String) async throws -> ParentDashboardSnapshot {
        try requireParentSession()
        _ = try await api.createReward(title: title, price: price, idempotencyKey: idempotencyKey)
        return try await fetchParentDashboard()
    }

    func archiveManagedReward(id: String) async throws -> ParentDashboardSnapshot {
        try requireParentSession()
        try await api.archiveReward(id: id)
        return try await fetchParentDashboard()
    }

    func fetchPhotoURL(photoID: String) async throws -> URL? {
        try requireParentSession()
        let status = try await api.fetchPhotoStatus(photoID: photoID)
        guard let raw = status.url else { return nil }
        return URL(string: raw)
    }

    private func requireParentSession() throws {
        guard authStore.parentSession != nil else {
            throw APIClientError.parentSessionMissing
        }
    }
}

enum ParentDashboardMapper {
    private static let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let isoFormatterBasic: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static func map(
        today: ParentTodayViewDTO,
        managedTasks: [ParentTaskManageDTO],
        managedRewards: [ParentRewardManageDTO],
        soundEnabled: Bool
    ) -> ParentDashboardSnapshot {
        let children = today.children.map { child -> ParentTodayChildSnapshot in
            let avatar = AvatarCatalog.emoji(for: child.avatarId)
            let tasks = child.instances
                .map { mapTask($0) }
                .sorted { lhs, rhs in
                    (lhs.submittedAt ?? .distantPast) < (rhs.submittedAt ?? .distantPast)
                }
            return ParentTodayChildSnapshot(
                id: child.childId,
                displayName: child.displayName,
                avatar: avatar,
                balancePoints: child.balance.balance,
                tasks: tasks
            )
        }

        var sections: [String: ApprovalQueueSection] = [:]
        for child in today.children {
            let avatar = AvatarCatalog.emoji(for: child.avatarId)
            let items = child.instances
                .filter { $0.status == "submitted" }
                .map { instance -> ApprovalQueueItem in
                    ApprovalQueueItem(
                        id: instance.id,
                        childID: child.childId,
                        childName: child.displayName,
                        childAvatar: avatar,
                        title: instance.title,
                        icon: instance.icon,
                        submittedAt: parseDate(instance.completedAt) ?? .now,
                        points: instance.points,
                        photoAsset: mapPhoto(instance),
                        photoStatus: instance.photoStatus
                    )
                }
                .sorted { $0.submittedAt < $1.submittedAt }

            guard !items.isEmpty else { continue }
            sections[child.childId] = ApprovalQueueSection(
                id: "queue-\(child.childId)",
                childID: child.childId,
                childName: child.displayName,
                childAvatar: avatar,
                items: items
            )
        }

        let approvalSections = sections.values.sorted { $0.childName < $1.childName }

        return ParentDashboardSnapshot(
            todayChildren: children,
            approvalSections: approvalSections,
            managedTasks: managedTasks.map {
                ParentManagedTask(
                    id: $0.id,
                    title: $0.title,
                    icon: $0.icon,
                    points: $0.points,
                    assigneeCount: $0.assignees.count
                )
            },
            managedRewards: managedRewards.map {
                ParentManagedReward(
                    id: $0.id,
                    title: $0.title,
                    icon: $0.icon,
                    price: $0.price
                )
            },
            settings: ParentSettingsSnapshot(
                soundEnabled: soundEnabled,
                exportAvailable: true,
                deleteAvailable: true
            ),
            lastSyncedAt: .now
        )
    }

    private static func mapTask(_ instance: InstanceViewDTO) -> ParentTaskSnapshot {
        ParentTaskSnapshot(
            id: instance.id,
            title: instance.title,
            icon: instance.icon,
            status: ParentTaskStatus(rawValue: instance.status) ?? .open,
            points: instance.points,
            submittedAt: parseDate(instance.completedAt),
            photoAsset: mapPhoto(instance),
            photoStatus: instance.photoStatus
        )
    }

    private static func mapPhoto(_ instance: InstanceViewDTO) -> ParentPhotoAsset? {
        guard let photoId = instance.photoId else { return nil }
        return ParentPhotoAsset(
            id: photoId,
            previewURL: nil,
            accessibilityLabel: String(localized: "parent.photo.accessibility.label"),
            status: instance.photoStatus
        )
    }

    private static func parseDate(_ value: String?) -> Date? {
        guard let value else { return nil }
        return isoFormatter.date(from: value) ?? isoFormatterBasic.date(from: value)
    }
}
