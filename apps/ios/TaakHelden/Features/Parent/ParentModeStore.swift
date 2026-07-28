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

    init(
        apiClient: APIClient,
        familyRoomClient: FamilyRoomClient = PreviewFamilyRoomClient(),
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
        familyRoomClient.disconnect()
        connectionState = .disconnected
        selectedApprovalIDs = []
        acknowledgedBulkPhotoReview = false
        fullscreenPhoto = nil
        selectedApprovalID = nil
        exportStatusMessage = nil
        deletionStatusMessage = nil
    }

    @MainActor
    func refresh(trigger: ParentSyncTrigger) async {
        isLoading = true
        loadErrorMessage = nil
        syncCoordinator.begin(trigger)

        do {
            let dashboard = try await apiClient.fetchParentDashboard()
            snapshot = dashboard
            if selectedApprovalID == nil {
                selectedApprovalID = dashboard.approvalSections.first?.items.first?.id
            } else if dashboard.approvalItem(id: selectedApprovalID ?? "") == nil {
                selectedApprovalID = dashboard.approvalSections.first?.items.first?.id
            }
            syncCoordinator.finish(trigger, at: dashboard.lastSyncedAt)
        } catch {
            loadErrorMessage = error.localizedDescription
            syncCoordinator.fail(trigger, message: error.localizedDescription)
        }

        isLoading = false
    }

    @MainActor
    func approve(_ item: ApprovalQueueItem) async {
        await mutateApprovalState(trigger: .approvalResolved) {
            snapshot = try await apiClient.approveApproval(id: item.id)
        }
    }

    @MainActor
    func sendRedo(for item: ApprovalQueueItem, note: String) async {
        await mutateApprovalState(trigger: .approvalResolved) {
            snapshot = try await apiClient.sendRedo(id: item.id, note: note)
        }
    }

    @MainActor
    func updateSoundPreference(isEnabled: Bool) async {
        guard var currentSnapshot = snapshot else { return }
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
        do {
            let receipt = try await apiClient.requestParentDataExport()
            exportStatusMessage = receipt.message
        } catch {
            exportStatusMessage = error.localizedDescription
        }
    }

    @MainActor
    func requestDeleteAccount() async -> Bool {
        do {
            try await apiClient.deleteParentAccount()
            deletionStatusMessage = "Je accountverzoek is verwerkt. Je wordt nu veilig teruggezet."
            return true
        } catch {
            deletionStatusMessage = error.localizedDescription
            return false
        }
    }

    func isSelected(_ item: ApprovalQueueItem) -> Bool {
        selectedApprovalIDs.contains(item.id)
    }

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

    func selectedItems() -> [ApprovalQueueItem] {
        guard let snapshot else { return [] }
        return snapshot.approvalSections
            .flatMap(\.items)
            .filter { selectedApprovalIDs.contains($0.id) }
    }

    func bulkApprovalValidation() -> BulkApprovalValidation {
        ParentApprovalRules.validateBulkApproval(
            selectedItems: selectedItems(),
            acknowledgedPhotoReview: acknowledgedBulkPhotoReview
        )
    }

    @MainActor
    func approveSelectedItems() async {
        let items = selectedItems()
        guard bulkApprovalValidation() == .allowed else {
            return
        }

        isBulkApproving = true
        defer { isBulkApproving = false }

        for item in items {
            await approve(item)
        }

        selectedApprovalIDs.removeAll()
        acknowledgedBulkPhotoReview = false
    }

    func openFullscreenPhoto(for item: ApprovalQueueItem) {
        fullscreenPhoto = item.photoAsset
        selectedApprovalID = item.id
    }

    func closeFullscreenPhoto() {
        fullscreenPhoto = nil
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
