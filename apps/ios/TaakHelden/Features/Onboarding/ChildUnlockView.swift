import SwiftUI

struct ChildUnlockView: View {
    @Environment(AppState.self) private var appState
    @State private var pin = ""
    @State private var errorMessage: String?

    private var session: StoredChildSession? {
        appState.authStore.childSession
    }

    private var unlockMode: ChildUnlockMode {
        guard let session else { return .pinOnly }
        return ParentGatePolicy.childUnlockMode(
            for: session.ageBand,
            biometricsEnabled: session.biometricsEnabled && appState.localAuth.canEvaluateBiometrics()
        )
    }

    var body: some View {
        let palette = session?.ageBand == .teen ? THPalettes.teen : THPalettes.kid

        VStack(spacing: THSpacing.xl) {
            Spacer()

            if let session {
                Text(session.avatar)
                    .font(.system(size: 72))
                Text("Hoi \(session.displayName)!")
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                    .foregroundStyle(palette.text.color)
            }

            THCard(palette: palette) {
                Text("Ontgrendel je heldenplek")
                    .font(.headline)
                    .foregroundStyle(palette.text.color)

                if unlockMode != .pinOnly {
                    Button {
                        Task { await unlockWithBiometrics() }
                    } label: {
                        Label("Gebruik Face ID", systemImage: "faceid")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(palette.accent.color)
                }

                if unlockMode == .biometricsWithVisiblePIN || unlockMode == .biometricsWithOptionalPIN || unlockMode == .pinOnly {
                    Button("Gebruik pincode") {
                        // PIN pad is always visible below for under-13 compliance.
                    }
                    .buttonStyle(.bordered)
                    .accessibilityHint("Altijd beschikbaar naast Face ID")

                    NumericPINPad(pin: $pin, maxDigits: 4) {
                        submitPIN()
                    }
                }
            }

            if let errorMessage {
                Text(errorMessage)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }

            Spacer()
        }
        .padding(THSpacing.xl)
        .background(palette.background.color.ignoresSafeArea())
        .preferredColorScheme(.light)
    }

    private func submitPIN() {
        guard appState.authStore.verifyPIN(pin) else {
            errorMessage = "Die pincode klopt nog niet — probeer het rustig opnieuw."
            pin = ""
            return
        }
        errorMessage = nil
        appState.unlockChildHome()
    }

    private func unlockWithBiometrics() async {
        do {
            let success = try await appState.localAuth.evaluateBiometrics(
                reason: "Ontgrendel TaakHelden om verder te gaan."
            )
            if success {
                errorMessage = nil
                appState.unlockChildHome()
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct NumericPINPad: View {
    @Binding var pin: String
    let maxDigits: Int
    let onComplete: () -> Void

    private let rows = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["", "0", "⌫"]]

    var body: some View {
        VStack(spacing: THSpacing.md) {
            HStack(spacing: THSpacing.sm) {
                ForEach(0..<maxDigits, id: \.self) { index in
                    Circle()
                        .fill(index < pin.count ? Color.primary : Color.secondary.opacity(0.2))
                        .frame(width: 14, height: 14)
                }
            }

            ForEach(rows, id: \.self) { row in
                HStack(spacing: THSpacing.md) {
                    ForEach(row, id: \.self) { digit in
                        if digit.isEmpty {
                            Color.clear.frame(width: 72, height: 56)
                        } else {
                            Button {
                                tap(digit)
                            } label: {
                                Text(digit)
                                    .font(.system(size: 24, weight: .semibold, design: .rounded))
                                    .frame(width: 72, height: 56)
                                    .background(Color.secondary.opacity(0.12))
                                    .clipShape(RoundedRectangle(cornerRadius: THRadius.large))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(digit == "⌫" ? "Verwijder" : digit)
                        }
                    }
                }
            }
        }
    }

    private func tap(_ digit: String) {
        if digit == "⌫" {
            if !pin.isEmpty { pin.removeLast() }
            return
        }
        guard pin.count < maxDigits else { return }
        pin.append(digit)
        if pin.count == maxDigits {
            onComplete()
        }
    }
}
