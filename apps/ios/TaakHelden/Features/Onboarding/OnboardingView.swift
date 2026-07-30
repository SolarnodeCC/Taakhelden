import SwiftUI

struct WelcomeHubView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        // Family-app entry uses the parent (dashboard) register — calm teal on white.
        // Child pairing keeps a warm secondary CTA without flipping the whole hub to kid-coral.
        let palette = THPalettes.parent

        NavigationStack {
            VStack(spacing: THSpacing.xl) {
                Spacer()

                WispelWordmark(markSize: 36, font: .system(size: 34, weight: .bold, design: .rounded))
                    .foregroundStyle(palette.accent.color)
                    .accessibilityAddTraits(.isHeader)

                VStack(alignment: .leading, spacing: THSpacing.md) {
                    Text("Samen taken en huiswerk bijhouden — voor het hele gezin.")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(palette.text.color)

                    Text("Start als ouder een gezin, of koppel een kindertoestel met een gezinscode.")
                        .foregroundStyle(palette.mutedText.color)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Button("Ik ben een ouder") {
                    appState.openParentOnboarding()
                }
                .buttonStyle(.borderedProminent)
                .tint(palette.accent.color)
                .controlSize(.large)

                Button("Ik heb al een gezinscode") {
                    appState.openChildPairing()
                }
                .buttonStyle(.bordered)
                .tint(palette.accent.color)
                .controlSize(.large)

                Spacer()
            }
            .padding(THSpacing.xl)
            .background(palette.background.color.ignoresSafeArea())
        }
    }
}

struct ChildPairingFlowView: View {
    @Environment(AppState.self) private var appState
    @State private var familyCode = ""
    @State private var resolvedFamily: FamilyCodeLookup?
    @State private var selectedChildID: String?
    @State private var pin = ""
    @State private var biometricsEnabled = false
    @State private var errorMessage: String?

    var body: some View {
        let palette = THPalettes.kid

        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: THSpacing.lg) {
                    Text("Kindertoestel koppelen")
                        .font(.system(size: 30, weight: .bold, design: .rounded))
                        .foregroundStyle(palette.text.color)

                    THCard(palette: palette) {
                        Text("1. Gezinscode")
                            .font(.headline)
                        TextField("123456", text: $familyCode)
                            .keyboardType(.numberPad)
                            .textFieldStyle(.roundedBorder)

                        Button("Profielen laden") {
                            Task { await resolveFamilyCode() }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(palette.accent.color)
                    }

                    if let family = resolvedFamily {
                        THCard(palette: palette) {
                            Text("2. Kies jouw profiel bij \(family.familyName)")
                                .font(.headline)

                            ForEach(family.children) { child in
                                Button {
                                    selectedChildID = child.id
                                } label: {
                                    HStack {
                                        Text(child.avatar)
                                            .font(.system(size: 28))
                                        VStack(alignment: .leading) {
                                            Text(child.displayName)
                                                .foregroundStyle(palette.text.color)
                                            Text(child.ageBand == .teen ? "Teenmodus" : "Kindmodus")
                                                .font(.footnote)
                                                .foregroundStyle(palette.mutedText.color)
                                        }
                                        Spacer()
                                        if selectedChildID == child.id {
                                            Image(systemName: "checkmark.circle.fill")
                                                .foregroundStyle(palette.secondary.color)
                                        }
                                    }
                                    .padding(THSpacing.md)
                                    .background(selectedChildID == child.id ? palette.accentSoft.color : palette.surface.color)
                                    .clipShape(RoundedRectangle(cornerRadius: THRadius.large, style: .continuous))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    THCard(palette: palette) {
                        Text("3. Gebruik pincode")
                            .font(.headline)
                        SecureField("4 cijfers", text: $pin)
                            .keyboardType(.numberPad)
                            .textFieldStyle(.roundedBorder)

                        Toggle("Face ID mag later helpen", isOn: $biometricsEnabled)
                            .tint(palette.accent.color)

                        Text("Voor kinderen onder 13 blijft 'Gebruik pincode' altijd zichtbaar naast Face ID.")
                            .font(.footnote)
                            .foregroundStyle(palette.mutedText.color)
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .foregroundStyle(.red)
                    }

                    Button("Koppelen en verder") {
                        Task { await finishPairing() }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(palette.accent.color)
                    .disabled(selectedChildID == nil || pin.count != 4)
                }
                .padding(THSpacing.xl)
            }
            .background(palette.background.color.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Terug") {
                        appState.returnToWelcome()
                    }
                }
            }
        }
    }

    @MainActor
    private func resolveFamilyCode() async {
        do {
            resolvedFamily = try await appState.apiClient.resolveFamilyCode(familyCode)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func finishPairing() async {
        guard let selectedChildID else { return }
        let selectedChild = resolvedFamily?.children.first { $0.id == selectedChildID }

        do {
            let session = try await appState.apiClient.pairChild(
                request: ChildPairingRequest(
                    familyCode: familyCode,
                    childID: selectedChildID,
                    pin: pin,
                    ageBand: selectedChild?.ageBand ?? .mid
                )
            )
            appState.authStore.storeChildSession(
                session,
                biometricsEnabled: biometricsEnabled,
                pin: pin
            )
            appState.finishChildPairing()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
