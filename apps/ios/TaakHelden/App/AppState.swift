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

    private(set) lazy var parentMode = ParentModeStore(apiClient: PreviewAPIClient())

    init(usePreviewData: Bool = false) {
        environment = AppEnvironment(usePreviewData: usePreviewData)
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

    func openParentGate(from entryPoint: ParentGateEntryPoint) {
        parentGate.openGate(from: entryPoint)
    }

    @MainActor
    func attemptLocalAuthUnlock() async -> Bool {
        do {
            let success = try await localAuth.evaluateBiometrics(
                reason: NSLocalizedString("parent.gate.la.reason", comment: "")
            )
            if success {
                parentGate.unlock(using: .localAuthentication)
            }
            return success
        } catch {
            return false
        }
    }

    func unlockParentMode(using method: ParentGateUnlockMethod) {
        parentGate.unlock(using: method)
    }

    func closeParentMode() {
        parentMode.endSession()
        parentGate.closeParentMode()
    }

    func returnToWelcome() {
        route = .welcome
    }
}
