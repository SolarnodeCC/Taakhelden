import Foundation
import Observation

@Observable
final class ParentModeStore {
    private let apiClient: APIClient
    private let familyRoomClient: FamilyRoomClient

    let syncCoordinator: ParentSyncCoordinator

    var activeSurface: ParentSurface = .goedkeuren
    var snapshot: ParentDashboardSnapshot?
    var selectedApprovalID: String?
    var selectedApprovalIDs: Set<String> = []
    var acknowledgedBulkPhotoReview = false
    var fullscreenPhoto: ParentPhotoAsset?
    var exportStatusMessage: String?
    var deletionStatusMessage: String?
    var isLoading = false
    var isBulkApproving = false
    var loadErrorMessage: String?
    var connectionState: FamilyRoomConnectionState = .disconnected
    var isSessionActive = false
    var needsParentAccount = false
    var bulkFailureMessage: String?
    var draftTaskTitle = ""
    var draftTaskPoints = 10
    var draftRewardTitle = ""
    var draftRewardPrice = 40
    private var exportTask: Task<Void, Never>?

    static let bulkConcurrencyLimit = 4

    init(
        apiClient: APIClient,
        familyRoomClient: FamilyRoomClient,
        syncCoordinator: ParentSyncCoordinator = ParentSyncCoordinator()
    ) {
        self.apiClient = apiClient
        self.familyRoomClient = familyRoomClient
        self.syncCoordinator = syncCoordinator
    }

    @MainActor
    func beginSession() async {
        guard !isSessionActive else {
            return
        }

        isSessionActive = true
        connectRealtime()
        await refresh(trigger: .appBecameActive)
    }

    @MainActor
    func handleBackgroundPushRefresh() async {
        await refresh(trigger: .backgroundPush)
    }

    @MainActor
    func endSession() {
        isSessionActive = false
        exportTask?.cancel()
        exportTask = nil
        familyRoomClient.disconnect()
        connectionState = .disconnected
        selectedApprovalIDs = []
        acknowledgedBulkPhotoReview = false
        fullscreenPhoto = nil
        selectedApprovalID = nil
        exportStatusMessage = nil
        deletionStatusMessage = nil
        bulkFailureMessage = nil
        needsParentAccount = false
    }

    @MainActor
    func refresh(trigger: ParentSyncTrigger) async {
        isLoading = true
        loadErrorMessage = nil
        needsParentAccount = false
        syncCoordinator.begin(trigger)

        do {
            let dashboard = try await apiClient.fetchParentDashboard()
            snapshot = dashboard
            OpenTaskCountStore.shared.update(count: dashboard.openTaskCount)
            if selectedApprovalID == nil {
                selectedApprovalID = dashboard.approvalSections.first?.items.first?.id
            } else if dashboard.approvalItem(id: selectedApprovalID ?? "") == nil {
                selectedApprovalID = dashboard.approvalSections.first?.items.first?.id
            }
            syncCoordinator.finish(trigger, at: dashboard.lastSyncedAt)
        } catch let error as APIClientError where error == .parentSessionMissing {
            needsParentAccount = true
            loadErrorMessage = error.localizedDescription
            syncCoordinator.fail(trigger, message: error.localizedDescription)
        } catch {
            loadErrorMessage = error.localizedDescription
            syncCoordinator.fail(trigger, message: error.localizedDescription)
        }

        isLoading = false
    }

    @MainActor
    func approve(_ item: ApprovalQueueItem) async {
        let key = IdempotencyKey.forApproval(instanceID: item.id)
        await mutateApprovalState(trigger: .approvalResolved) {
            snapshot = try await apiClient.approveApproval(id: item.id, idempotencyKey: key)
        }
    }

    @MainActor
    func sendRedo(for item: ApprovalQueueItem, note: String) async {
        let key = IdempotencyKey.forRedo(instanceID: item.id)
        await mutateApprovalState(trigger: .approvalResolved) {
            snapshot = try await apiClient.sendRedo(id: item.id, note: note, idempotencyKey: key)
        }
    }

    @MainActor
    func updateSoundPreference(isEnabled: Bool) async {
        guard var currentSnapshot = snapshot else {
            _ = try? await apiClient.updateParentSettings(soundEnabled: isEnabled)
            return
        }
        syncCoordinator.begin(.settingsChanged)
        do {
            let updated = try await apiClient.updateParentSettings(soundEnabled: isEnabled)
            currentSnapshot.settings = updated
            snapshot = currentSnapshot
            syncCoordinator.finish(.settingsChanged, at: .now)
        } catch {
            loadErrorMessage = error.localizedDescription
            syncCoordinator.fail(.settingsChanged, message: error.localizedDescription)
        }
    }

    @MainActor
    func requestExport() async {
        exportTask?.cancel()
        let task = Task { @MainActor in
            do {
                let receipt = try await apiClient.requestParentDataExport()
                guard !Task.isCancelled else { return }
                exportStatusMessage = receipt.message
            } catch is CancellationError {
                return
            } catch {
                guard !Task.isCancelled else { return }
                exportStatusMessage = error.localizedDescription
            }
        }
        exportTask = task
        await task.value
    }

    @MainActor
    func requestDeleteAccount() async -> Bool {
        do {
            try await apiClient.deleteParentAccount()
            deletionStatusMessage = String(localized: "parent.settings.delete.success")
            return true
        } catch let error as APIClientError where error == .parentReauthRequired {
            deletionStatusMessage = error.localizedDescription
            return false
        } catch {
            deletionStatusMessage = error.localizedDescription
            return false
        }
    }

    @MainActor
    func requestDeleteAccount(appleIdentityToken: String) async -> Bool {
        do {
            try await apiClient.deleteParentAccount(appleIdentityToken: appleIdentityToken)
            deletionStatusMessage = String(localized: "parent.settings.delete.success")
            return true
        } catch {
            deletionStatusMessage = error.localizedDescription
            return false
        }
    }

    @MainActor
    func createTaskFromDraft(defaultChildIDs: [String]) async {
        let title = draftTaskTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        let childIDs = defaultChildIDs.filter { !$0.isEmpty }
        guard !childIDs.isEmpty else {
            loadErrorMessage = String(localized: "parent.tasks.need.child")
            return
        }
        do {
            snapshot = try await apiClient.createManagedTask(
                title: title,
                points: max(draftTaskPoints, 1),
                childIDs: childIDs,
                idempotencyKey: IdempotencyKey.forTaskCreate()
            )
            draftTaskTitle = ""
        } catch {
            loadErrorMessage = error.localizedDescription
        }
    }

    @MainActor
    func archiveTask(id: String) async {
        do {
            snapshot = try await apiClient.archiveManagedTask(id: id)
        } catch {
            loadErrorMessage = error.localizedDescription
        }
    }

    @MainActor
    func createRewardFromDraft() async {
        let title = draftRewardTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        do {
            snapshot = try await apiClient.createManagedReward(
                title: title,
                price: max(draftRewardPrice, 1),
                idempotencyKey: IdempotencyKey.forRewardCreate()
            )
            draftRewardTitle = ""
        } catch {
            loadErrorMessage = error.localizedDescription
        }
    }

    @MainActor
    func archiveReward(id: String) async {
        do {
            snapshot = try await apiClient.archiveManagedReward(id: id)
        } catch {
            loadErrorMessage = error.localizedDescription
        }
    }

    @MainActor
    func approveSelectedItems() async {
        let items = selectedItems()
        guard bulkApprovalValidation() == .allowed else {
            return
        }

        isBulkApproving = true
        bulkFailureMessage = nil
        defer { isBulkApproving = false }

        let keys = Dictionary(uniqueKeysWithValues: items.map { ($0.id, IdempotencyKey.forApproval(instanceID: $0.id)) })
        var failures = 0
        var inFlight = 0

        await withTaskGroup(of: Bool.self) { group in
            for item in items {
                if inFlight >= Self.bulkConcurrencyLimit {
                    if let ok = await group.next() {
                        inFlight -= 1
                        if !ok { failures += 1 }
                    }
                }
                inFlight += 1
                let key = keys[item.id] ?? IdempotencyKey.forApproval(instanceID: item.id)
                group.addTask { [apiClient] in
                    do {
                        _ = try await apiClient.approveApproval(id: item.id, idempotencyKey: key)
                        return true
                    } catch {
                        return false
                    }
                }
            }
            for await ok in group {
                if !ok { failures += 1 }
            }
        }

        await refresh(trigger: .approvalResolved)

        if failures > 0 {
            bulkFailureMessage = String(format: String(localized: "parent.bulk.failures"), failures)
        }

        selectedApprovalIDs.removeAll()
        acknowledgedBulkPhotoReview = false
    }

    @MainActor
    func openFullscreenPhoto(for item: ApprovalQueueItem) async {
        selectedApprovalID = item.id
        guard var asset = item.photoAsset else {
            fullscreenPhoto = nil
            return
        }
        if asset.previewURL == nil, let url = try? await apiClient.fetchPhotoURL(photoID: asset.id) {
            asset = ParentPhotoAsset(
                id: asset.id,
                previewURL: url,
                accessibilityLabel: asset.accessibilityLabel,
                status: asset.status
            )
        }
        fullscreenPhoto = asset
    }

    @MainActor
    func closeFullscreenPhoto() {
        fullscreenPhoto = nil
    }

    @MainActor
    func isSelected(_ item: ApprovalQueueItem) -> Bool {
        selectedApprovalIDs.contains(item.id)
    }

    @MainActor
    func toggleSelection(for item: ApprovalQueueItem) {
        if selectedApprovalIDs.contains(item.id) {
            selectedApprovalIDs.remove(item.id)
        } else {
            selectedApprovalIDs.insert(item.id)
        }

        if !selectedApprovalIDs.contains(where: { selectedID in
            snapshot?.approvalItem(id: selectedID)?.hasPhoto == true
        }) {
            acknowledgedBulkPhotoReview = false
        }
    }

    @MainActor
    func selectedItems() -> [ApprovalQueueItem] {
        guard let snapshot else { return [] }
        return snapshot.approvalSections
            .flatMap(\.items)
            .sorted { $0.submittedAt < $1.submittedAt }
            .filter { selectedApprovalIDs.contains($0.id) }
    }

    @MainActor
    func bulkApprovalValidation() -> BulkApprovalValidation {
        ParentApprovalRules.validateBulkApproval(
            selectedItems: selectedItems(),
            acknowledgedPhotoReview: acknowledgedBulkPhotoReview
        )
    }

    private func connectRealtime() {
        familyRoomClient.connect { [weak self] state in
            Task { @MainActor in
                self?.connectionState = state
            }
        } onEvent: { [weak self] _ in
            Task { @MainActor in
                await self?.refresh(trigger: .websocketReconnect)
            }
        }
    }

    @MainActor
    private func mutateApprovalState(
        trigger: ParentSyncTrigger,
        operation: () async throws -> Void
    ) async {
        syncCoordinator.begin(trigger)
        do {
            try await operation()
            syncCoordinator.finish(trigger, at: snapshot?.lastSyncedAt ?? .now)
            if selectedApprovalIDs.isEmpty == false {
                selectedApprovalIDs = selectedApprovalIDs.filter { selectedID in
                    snapshot?.approvalItem(id: selectedID) != nil
                }
            }
            if let selectedApprovalID, snapshot?.approvalItem(id: selectedApprovalID) == nil {
                self.selectedApprovalID = snapshot?.approvalSections.first?.items.first?.id
            }
        } catch {
            loadErrorMessage = error.localizedDescription
            syncCoordinator.fail(trigger, message: error.localizedDescription)
        }
    }
}
