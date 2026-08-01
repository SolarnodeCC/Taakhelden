import Foundation
import Observation

@Observable
final class AppState {
    enum Route {
        case welcome
        case parentOnboarding
        case childPairing
        case childUnlock
        case childHome
    }

    var route: Route = .welcome
    var selectedChildTab: ChildTab = .mijnDag
    let environment: AppEnvironment

    var authStore: AuthStore { environment.authStore }
    var apiClient: TaakHeldenAPIClient { environment.apiClient }
    var mutationQueue: MutationQueue { environment.mutationQueue }
    var syncEngine: SyncEngine { environment.syncEngine }
    var parentGate: ParentGateCoordinator { environment.parentGate }
    var localAuth: LocalAuthenticationClient { environment.localAuth }
    var celebrationService: CelebrationService { environment.celebrationService }
    var photoBonusService: PhotoBonusService { environment.photoBonusService }
    var pushService: PushRegistrationService { environment.pushService }

    var parentMode: ParentModeStore
    var pendingParentDeepLinkSurface: ParentSurface?

    init(usePreviewData: Bool = false) {
        environment = AppEnvironment(usePreviewData: usePreviewData)
        parentMode = ParentModeStore(
            apiClient: environment.parentAPIClient,
            familyRoomClient: environment.familyRoomClient
        )
    }

    @MainActor
    func restoreSessionIfAvailable() async {
        switch authStore.restoredRoute {
        case .childHome:
            route = .childHome
        case .childUnlock:
            route = .childUnlock
        case .parentOnboarding:
            route = .parentOnboarding
        case .welcome:
            route = .welcome
        }
    }

    func openParentOnboarding() {
        route = .parentOnboarding
    }

    func openChildPairing() {
        route = .childPairing
    }

    func finishChildPairing() {
        route = .childHome
    }

    func unlockChildHome() {
        authStore.unlockChildSession()
        route = .childHome
    }

    func openParentGate(from entryPoint: ParentGateEntryPoint, preferSurface: ParentSurface? = nil) {
        if let preferSurface {
            pendingParentDeepLinkSurface = preferSurface
        }
        parentGate.openGate(from: entryPoint)
    }

    @MainActor
    func attemptLocalAuthUnlock() async -> Bool {
        do {
            let success = try await localAuth.evaluateDeviceOwner(
                reason: NSLocalizedString("parent.gate.la.reason", comment: "")
            )
            if success {
                parentGate.unlock(using: .localAuthentication)
                applyPendingDeepLinkSurface()
            }
            return success
        } catch {
            return false
        }
    }

    func unlockParentMode(using method: ParentGateUnlockMethod) {
        parentGate.unlock(using: method)
        applyPendingDeepLinkSurface()
    }

    @MainActor
    func closeParentMode() {
        parentMode.endSession()
        parentGate.closeParentMode()
        pendingParentDeepLinkSurface = nil
    }

    /// Logs out the current user and navigates to the welcome screen.
    ///
    /// Deregisters the device push token for the **departing** user before
    /// clearing sessions.  On a shared iPad, only the acting user's
    /// (apnsToken, user_id) row is removed; other profiles remain intact.
    @MainActor
    func returnToWelcome() async {
        if let token = APNSTokenStore.shared.apnsToken,
           authStore.childSession != nil || authStore.parentSession != nil {
            try? await apiClient.deregisterDevice(apnsToken: token)
        }
        authStore.clearAllSessions()
        route = .welcome
    }

    @MainActor
    func handleBackgroundPushRefresh() async {
        await syncEngine.syncNow()
        if parentGate.isParentModePresented {
            await parentMode.handleBackgroundPushRefresh()
        }
    }

    @MainActor
    func enforceParentIdleTimeoutIfNeeded() {
        guard parentGate.isParentModePresented else { return }
        if parentGate.parentSessionRequiresReauth() {
            closeParentMode()
        }
    }

    private func applyPendingDeepLinkSurface() {
        if let pendingParentDeepLinkSurface {
            parentMode.activeSurface = pendingParentDeepLinkSurface
            self.pendingParentDeepLinkSurface = nil
        }
    }
}
