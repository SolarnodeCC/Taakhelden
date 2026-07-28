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

    func returnToWelcome() {
        route = .welcome
    }
}
