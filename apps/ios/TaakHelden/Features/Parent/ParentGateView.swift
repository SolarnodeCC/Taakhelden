import SwiftUI

struct ParentGateView: View {
    @Environment(AppState.self) private var appState
    @State private var statusMessage: String?
    @State private var isAuthenticating = false
    @State private var showsParentAccountSheet = false

    var body: some View {
        let palette = THPalettes.parent

        VStack(alignment: .leading, spacing: THSpacing.lg) {
            Text(LocalizedStringKey("parent.gate.title"))
                .font(.title2.bold())
                .foregroundStyle(palette.text.color)

            Text(LocalizedStringKey("parent.gate.description"))
                .foregroundStyle(palette.mutedText.color)

            VStack(alignment: .leading, spacing: THSpacing.sm) {
                Text(LocalizedStringKey("parent.gate.behind"))
                    .font(.headline)
                    .foregroundStyle(palette.text.color)
                Text(LocalizedStringKey("parent.gate.behind.detail"))
                    .foregroundStyle(palette.mutedText.color)
            }
            .padding(THSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(palette.surface.color)
            .clipShape(RoundedRectangle(cornerRadius: THRadius.medium, style: .continuous))
            .shadow(color: .black.opacity(0.04), radius: 3, y: 1)

            Text(LocalizedStringKey("parent.gate.child.pin.blocked"))
                .font(.footnote.weight(.semibold))
                .foregroundStyle(palette.mutedText.color)

            Button(String(localized: "parent.gate.la.button")) {
                Task { await unlockWithDeviceOwner() }
            }
            .buttonStyle(.borderedProminent)
            .tint(palette.accent.color)
            .disabled(isAuthenticating)

            Button(String(localized: "parent.gate.account.button")) {
                showsParentAccountSheet = true
            }
            .buttonStyle(.bordered)

            Button(String(localized: "parent.gate.cancel")) {
                appState.parentGate.closeGate()
            }
            .buttonStyle(.borderless)

            if let statusMessage {
                Text(statusMessage)
                    .foregroundStyle(palette.mutedText.color)
            }

            Text(LocalizedStringKey("parent.gate.push.note"))
                .font(.footnote)
                .foregroundStyle(palette.mutedText.color)
        }
        .padding(THSpacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(palette.background.color.ignoresSafeArea())
        .sheet(isPresented: $showsParentAccountSheet) {
            ParentAccountUnlockSheet { session in
                appState.authStore.storeParentSession(session)
                appState.unlockParentMode(using: .parentAccount)
                showsParentAccountSheet = false
            }
        }
        .onDisappear {
            statusMessage = nil
            isAuthenticating = false
        }
    }

    private func unlockWithDeviceOwner() async {
        isAuthenticating = true
        defer { isAuthenticating = false }

        let success = await appState.attemptLocalAuthUnlock()
        if success {
            statusMessage = nil
        } else {
            statusMessage = String(localized: "parent.gate.la.failed")
        }
    }
}

private struct ParentAccountUnlockSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var errorMessage: String?

    let onAuthenticated: (ParentSession) -> Void

    var body: some View {
        let palette = THPalettes.parent

        NavigationStack {
            VStack(alignment: .leading, spacing: THSpacing.lg) {
                Text(LocalizedStringKey("parent.gate.account.title"))
                    .font(.title3.bold())
                    .foregroundStyle(palette.text.color)
                Text(LocalizedStringKey("parent.gate.account.detail"))
                    .foregroundStyle(palette.mutedText.color)

                SignInWithAppleButtonView { identityToken, familyName, displayName in
                    Task {
                        do {
                            let session = try await appState.apiClient.signInWithApple(
                                identityToken: identityToken,
                                familyName: familyName,
                                displayName: displayName
                            )
                            onAuthenticated(session)
                        } catch {
                            errorMessage = error.localizedDescription
                        }
                    }
                } onFailure: { error in
                    errorMessage = error.localizedDescription
                }

                if let errorMessage {
                    Text(errorMessage)
                        .foregroundStyle(palette.mutedText.color)
                }

                Spacer()
            }
            .padding(THSpacing.xl)
            .background(palette.background.color.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(String(localized: "parent.gate.cancel")) { dismiss() }
                }
            }
        }
    }
}
