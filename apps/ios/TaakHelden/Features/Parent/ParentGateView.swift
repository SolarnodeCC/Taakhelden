import LocalAuthentication
import SwiftUI

struct ParentGateView: View {
    @Environment(AppState.self) private var appState
    @State private var statusMessage: String?
    @State private var soundsEnabled = AppSettings.childSoundsEnabled
    @State private var isAuthenticated = false

    var body: some View {
        let palette = THPalettes.parent

        VStack(alignment: .leading, spacing: THSpacing.lg) {
            Text("Ouderpoort")
                .font(.title2.bold())
                .foregroundStyle(palette.text.color)

            Text("Alleen ouders komen hier. Kind-pincode opent dit scherm bewust niet.")
                .foregroundStyle(palette.mutedText.color)

            if isAuthenticated {
                unlockedContent(palette: palette)
            } else {
                lockedContent(palette: palette)
            }

            if let statusMessage {
                Text(statusMessage)
                    .foregroundStyle(palette.mutedText.color)
            }

            Text("Push-links naar goedkeuren landen ook eerst hier, met generieke meldingstekst op het lockscreen.")
                .font(.footnote)
                .foregroundStyle(palette.mutedText.color)
        }
        .padding(THSpacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(palette.background.color.ignoresSafeArea())
        .onDisappear {
            isAuthenticated = false
            statusMessage = nil
        }
    }

    @ViewBuilder
    private func lockedContent(palette: THPalette) -> some View {
        Button("Ontgrendel met Face ID of toestelcode") {
            Task { await unlockWithDeviceOwner() }
        }
        .buttonStyle(.borderedProminent)
        .tint(palette.accent.color)
    }

    @ViewBuilder
    private func unlockedContent(palette: THPalette) -> some View {
        Toggle("Geluid bij taak klaar", isOn: $soundsEnabled)
            .tint(palette.accent.color)
            .onChange(of: soundsEnabled) { _, enabled in
                AppSettings.childSoundsEnabled = enabled
            }

        Text("Goedkeuren en ouderbeheer volgen in Phase 2.")
            .foregroundStyle(palette.mutedText.color)

        Button("Sluiten") {
            appState.parentGate.closeGate()
        }
        .buttonStyle(.bordered)
    }

    private func unlockWithDeviceOwner() async {
        do {
            let success = try await LAContextWrapper.evaluateDeviceOwner(reason: "Bevestig dat je de ouder bent.")
            if success {
                isAuthenticated = true
                statusMessage = nil
            } else {
                statusMessage = "Dat lukte niet. Probeer het opnieuw of log in als ouder."
            }
        } catch {
            statusMessage = "Dat lukte niet. Probeer het opnieuw of log in als ouder."
        }
    }
}

enum LAContextWrapper {
    static func evaluateDeviceOwner(reason: String) async throws -> Bool {
        let context = LAContext()
        return try await withCheckedThrowingContinuation { continuation in
            context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: success)
                }
            }
        }
    }
}
