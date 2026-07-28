import SwiftUI

@main
struct TaakHeldenApp: App {
    @State private var appState = AppState(usePreviewData: false)

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
        }
    }
}

struct RootView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            switch appState.route {
            case .welcome:
                WelcomeHubView()
            case .parentOnboarding:
                ParentOnboardingFlowView()
            case .childPairing:
                ChildPairingFlowView()
            case .childUnlock:
                ChildUnlockView()
            case .childHome:
                ChildShellView()
                    .preferredColorScheme(.light)
            }
        }
        .task {
            await appState.restoreSessionIfAvailable()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background {
                appState.authStore.lockChildSession()
                if appState.route == .childHome {
                    appState.route = .childUnlock
                }
            }
            if phase == .active, appState.route == .childHome {
                Task { _ = await appState.syncEngine.syncNow() }
            }
        }
    }
}

#if DEBUG
struct RootView_Previews: PreviewProvider {
    static var previews: some View {
        RootView()
            .environment(AppState(usePreviewData: true))
    }
}
#endif
