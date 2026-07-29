import SwiftUI

struct ChildUnlockView: View {
    @Environment(AppState.self) private var appState
    @State private var pin = ""
    @State private var errorMessage: String?
    @State private var pictureSelection: [String] = []

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

    private var isYoung: Bool {
        session?.ageBand == .young
    }

    var body: some View {
        let palette = session?.ageBand == .teen ? THPalettes.teen : THPalettes.kid

        VStack(spacing: THSpacing.xl) {
            Spacer()

            if let session {
                Text(session.avatar)
                    .font(.system(size: isYoung ? 88 : 72))
                Text(isYoung ? "Hoi!" : "Hoi \(session.displayName)!")
                    .font(.system(size: isYoung ? 36 : 32, weight: .bold, design: .rounded))
                    .foregroundStyle(palette.text.color)

                if isYoung {
                    Button {
                        YoungModeSupport.speak("Hoi \(session.displayName). Ontgrendel je heldenplek.")
                    } label: {
                        Label(String(localized: "child.young.speak"), systemImage: "speaker.wave.2.fill")
                    }
                    .buttonStyle(.bordered)
                    .tint(palette.accent.color)
                    .accessibilityLabel(String(localized: "child.young.speak"))
                }
            }

            THCard(palette: palette) {
                Text(isYoung ? String(localized: "child.young.unlock.title") : "Ontgrendel je heldenplek")
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

                if isYoung {
                    Text(LocalizedStringKey("child.young.picture.hint"))
                        .font(.footnote)
                        .foregroundStyle(palette.mutedText.color)
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 64))], spacing: THSpacing.md) {
                        ForEach(YoungModeSupport.picturePINChoices, id: \.self) { emoji in
                            Button {
                                selectPicture(emoji)
                            } label: {
                                Text(emoji)
                                    .font(.system(size: 40))
                                    .frame(width: 64, height: 64)
                                    .background(palette.surface.color)
                                    .clipShape(RoundedRectangle(cornerRadius: THRadius.large, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(emoji)
                        }
                    }
                    Text(pictureSelection.joined(separator: " "))
                        .font(.title2)
                        .frame(minHeight: 36)
                }

                if unlockMode == .biometricsWithVisiblePIN || unlockMode == .biometricsWithOptionalPIN || unlockMode == .pinOnly {
                    if !isYoung {
                        Button("Gebruik pincode") {
                            // PIN pad is always visible below for under-13 compliance.
                        }
                        .buttonStyle(.bordered)
                        .accessibilityHint("Altijd beschikbaar naast Face ID")
                    }

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

    private func selectPicture(_ emoji: String) {
        if pictureSelection.count >= 3 {
            pictureSelection.removeAll()
        }
        pictureSelection.append(emoji)
        if pictureSelection.count == 3 {
            // Picture-PIN is an unlock UX foundation; MVP still validates numeric PIN
            // until parents can configure a picture sequence server-side.
            YoungModeSupport.speak("Kies nu je pincode.")
        }
    }

    private func submitPIN() {
        guard appState.authStore.verifyPIN(pin) else {
            errorMessage = isYoung
                ? String(localized: "child.young.pin.retry")
                : "Die pincode klopt nog niet — probeer het rustig opnieuw."
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
        } catch let error as LocalAuthenticationError {
            errorMessage = error.localizedDescription
        } catch {
            errorMessage = LocalAuthenticationError.unavailable.localizedDescription
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
