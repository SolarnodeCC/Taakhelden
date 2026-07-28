import SwiftUI

@main
struct TaakHeldenApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
        }
    }
}

struct RootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            switch appState.route {
            case .welcome:
                WelcomeHubView()
            case .parentOnboarding:
                ParentOnboardingFlowView()
            case .childPairing:
                ChildPairingFlowView()
            case .childHome:
                ChildShellView()
                    .preferredColorScheme(.light)
            }
        }
        .task {
            await appState.restoreSessionIfAvailable()
        }
    }
}
