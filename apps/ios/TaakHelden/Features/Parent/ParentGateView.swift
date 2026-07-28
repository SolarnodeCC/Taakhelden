import SwiftUI

struct ParentGateView: View {
    @Environment(AppState.self) private var appState
    @State private var statusMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: THSpacing.lg) {
            Text("Ouderpoort")
                .font(.title2.bold())

            Text("Alleen ouders komen hier. Kind-pincode opent dit scherm bewust niet.")
                .foregroundStyle(.secondary)

            Button("Ontgrendel met Face ID of toestelcode") {
                Task { await unlockWithDeviceOwner() }
            }
            .buttonStyle(.borderedProminent)

            if let statusMessage {
                Text(statusMessage)
                    .foregroundStyle(.secondary)
            }

            Text("Push-links naar goedkeuren landen ook eerst hier, met generieke meldingstekst op het lockscreen.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(THSpacing.xl)
    }

    private func unlockWithDeviceOwner() async {
        do {
            let success = try await LAContextWrapper.evaluateDeviceOwner(reason: "Bevestig dat je de ouder bent.")
            statusMessage = success ? "Ouderpoort geopend — goedkeuren volgt in Phase 2." : nil
            if success {
                appState.parentGate.closeGate()
            }
        } catch {
            statusMessage = "Dat lukte niet. Probeer het opnieuw of log in als ouder."
        }
    }
}

import LocalAuthentication

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
