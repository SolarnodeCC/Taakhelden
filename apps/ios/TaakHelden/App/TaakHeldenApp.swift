import SwiftUI
import UIKit

@main
struct TaakHeldenApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
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
            if phase == .active {
                if appState.route == .childHome {
                    Task { _ = await appState.syncEngine.syncNow() }
                }
                Task {
                    await UIApplication.shared.registerForRemoteNotifications()
                    await appState.pushService.registerIfNeeded(tokenProvider: APNSTokenStore.shared)
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .pushDeepLinkReceived)) { _ in
            if appState.route == .childHome {
                appState.openParentGate(from: .heroWordmarkLongPress, preferSurface: .goedkeuren)
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .silentPushReceived)) { _ in
            Task { await appState.handleBackgroundPushRefresh() }
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
