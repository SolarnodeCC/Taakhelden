import SwiftUI

struct WelcomeHubView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        let palette = THPalettes.kid

        NavigationStack {
            VStack(spacing: THSpacing.xl) {
                Spacer()

                Text("TaakHelden")
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .foregroundStyle(palette.text.color)

                THCard(palette: palette) {
                    Text("Samen klussen klaren voelt fijner als iedereen kan groeien in zijn eigen tempo.")
                        .font(.system(size: 20, weight: .semibold, design: .rounded))
                        .foregroundStyle(palette.text.color)

                    Text("Kies of je eerst een gezin wilt starten of een kindertoestel wilt koppelen.")
                        .foregroundStyle(palette.mutedText.color)
                }

                Button("Ik ben een ouder") {
                    appState.openParentOnboarding()
                }
                .buttonStyle(.borderedProminent)
                .tint(palette.accent.color)

                Button("Ik heb al een gezinscode") {
                    appState.openChildPairing()
                }
                .buttonStyle(.bordered)

                Spacer()
            }
            .padding(THSpacing.xl)
            .background(palette.background.color.ignoresSafeArea())
        }
    }
}

struct ParentOnboardingFlowView: View {
    @Environment(AppState.self) private var appState
    @State private var familyName = ""
    @State private var childName = ""
    @State private var birthYear = "2018"
    @State private var pin = ""
    @State private var selectedAvatar = "🦊"

    private let avatars = ["🦊", "🐼", "🦁", "🐙", "🦄", "🐯"]

    var body: some View {
        let palette = THPalettes.parent

        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: THSpacing.lg) {
                    Text("Gezin starten")
                        .font(.system(size: 30, weight: .bold, design: .rounded))

                    THCard(palette: palette) {
                        Label("Sign in with Apple wordt hier de primaire native route.", systemImage: "applelogo")
                        Text("De entitlement en live auth-koppeling volgen nog, maar de flowvolgorde staat vast voor Phase 1.")
                            .foregroundStyle(palette.mutedText.color)
                    }

                    THCard(palette: palette) {
                        Text("Gezinsnaam")
                            .font(.headline)
                        TextField("Bijvoorbeeld Familie Jansen", text: $familyName)
                            .textFieldStyle(.roundedBorder)

                        Text("Eerste kind")
                            .font(.headline)
                        TextField("Roepnaam", text: $childName)
                            .textFieldStyle(.roundedBorder)

                        TextField("Geboortejaar", text: $birthYear)
                            .keyboardType(.numberPad)
                            .textFieldStyle(.roundedBorder)

                        Text("Kies een avatar")
                            .font(.headline)

                        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: THSpacing.md) {
                            ForEach(avatars, id: \.self) { avatar in
                                Button {
                                    selectedAvatar = avatar
                                } label: {
                                    Text(avatar)
                                        .font(.system(size: 40))
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, THSpacing.md)
                                        .background(selectedAvatar == avatar ? palette.accentSoft.color : palette.surface.color)
                                        .clipShape(RoundedRectangle(cornerRadius: THRadius.large, style: .continuous))
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        Text("Kind-pincode")
                            .font(.headline)
                        SecureField("4 cijfers", text: $pin)
                            .keyboardType(.numberPad)
                            .textFieldStyle(.roundedBorder)
                    }

                    THCard(palette: palette) {
                        Text("Demo voor App Review")
                            .font(.headline)
                        Text("Review-notes moeten een vooringestelde gezinscode en kind-pincode bevatten zodat Apple de flow op een device kan doorlopen.")
                            .foregroundStyle(palette.mutedText.color)
                    }

                    Button("Verder met gezin instellen") {
                        appState.openChildPairing()
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(palette.accent.color)
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
                                                .foregroundStyle(palette.accent.color)
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

        do {
            let session = try await appState.apiClient.pairChild(
                request: ChildPairingRequest(
                    familyCode: familyCode,
                    childID: selectedChildID,
                    pin: pin
                )
            )
            appState.authStore.storeChildSession(session, biometricsEnabled: biometricsEnabled)
            appState.finishChildPairing()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
