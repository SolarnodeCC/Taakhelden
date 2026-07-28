import Foundation
import Observation

@Observable
final class AppState {
    enum Route {
        case welcome
        case parentOnboarding
        case childPairing
        case childHome
    }

    var route: Route = .welcome
    var selectedChildTab: ChildTab = .mijnDag
    var authStore: AuthStore
    var apiClient: APIClient
    var parentGate: ParentGateCoordinator

    init(
        authStore: AuthStore = AuthStore(),
        apiClient: APIClient = PreviewAPIClient(),
        parentGate: ParentGateCoordinator = ParentGateCoordinator()
    ) {
        self.authStore = authStore
        self.apiClient = apiClient
        self.parentGate = parentGate
    }

    @MainActor
    func restoreSessionIfAvailable() async {
        switch authStore.restoredRoute {
        case .childHome:
            route = .childHome
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

    func returnToWelcome() {
        route = .welcome
    }
}
