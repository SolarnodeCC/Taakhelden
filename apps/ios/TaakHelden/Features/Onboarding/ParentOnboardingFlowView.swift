import SwiftUI

struct ParentOnboardingFlowView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel: ParentOnboardingViewModel?

    var body: some View {
        let palette = THPalettes.parent

        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: THSpacing.lg) {
                    Text("Gezin starten")
                        .font(.system(size: 30, weight: .bold, design: .rounded))

                    if let viewModel {
                        switch viewModel.step {
                        case .signIn:
                            signInStep(viewModel: viewModel, palette: palette)
                        case .createChild:
                            createChildStep(viewModel: viewModel, palette: palette)
                        case .showFamilyCode:
                            familyCodeStep(viewModel: viewModel, palette: palette)
                        }

                        if let error = viewModel.errorMessage {
                            Text(error)
                                .foregroundStyle(.red)
                        }

                        if viewModel.isLoading {
                            ProgressView()
                        }
                    }
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
            .task {
                if viewModel == nil {
                    viewModel = ParentOnboardingViewModel(
                        apiClient: appState.apiClient,
                        authStore: appState.authStore
                    )
                }
            }
        }
    }

    @ViewBuilder
    private func signInStep(viewModel: ParentOnboardingViewModel, palette: THPalette) -> some View {
        @Bindable var viewModel = viewModel
        THCard(palette: palette) {
            Text("Log in met Apple om je gezin te starten.")
                .foregroundStyle(palette.mutedText.color)

            TextField("Gezinsnaam (optioneel)", text: $viewModel.familyName)
                .textFieldStyle(.roundedBorder)

            SignInWithAppleButtonView(
                onToken: { token, familyName, displayName in
                    Task {
                        await viewModel.handleAppleSignIn(
                            identityToken: token,
                            familyName: familyName,
                            displayName: displayName
                        )
                    }
                },
                onFailure: { error in
                    viewModel.errorMessage = error.localizedDescription
                }
            )
        }
    }

    @ViewBuilder
    private func createChildStep(viewModel: ParentOnboardingViewModel, palette: THPalette) -> some View {
        @Bindable var viewModel = viewModel
        THCard(palette: palette) {
            Text("Eerste kind")
                .font(.headline)

            TextField("Roepnaam", text: $viewModel.childName)
                .textFieldStyle(.roundedBorder)

            TextField("Geboortejaar", text: $viewModel.birthYear)
                .keyboardType(.numberPad)
                .textFieldStyle(.roundedBorder)

            Text("Kies een avatar")
                .font(.headline)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: THSpacing.md) {
                ForEach(viewModel.avatarEmojis, id: \.self) { avatar in
                    Button {
                        viewModel.selectedAvatarEmoji = avatar
                    } label: {
                        Text(avatar)
                            .font(.system(size: 40))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, THSpacing.md)
                            .background(viewModel.selectedAvatarEmoji == avatar ? palette.accentSoft.color : palette.surface.color)
                            .clipShape(RoundedRectangle(cornerRadius: THRadius.large, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }

            Text("Kind-pincode")
                .font(.headline)
            SecureField("4 cijfers", text: $viewModel.pin)
                .keyboardType(.numberPad)
                .textFieldStyle(.roundedBorder)

            Button("Kind toevoegen") {
                Task { _ = await viewModel.createChildProfile() }
            }
            .buttonStyle(.borderedProminent)
            .tint(palette.accent.color)
            .disabled(viewModel.pin.count != 4 || viewModel.childName.isEmpty)
        }
    }

    @ViewBuilder
    private func familyCodeStep(viewModel: ParentOnboardingViewModel, palette: THPalette) -> some View {
        THCard(palette: palette) {
            Text("Je gezinscode")
                .font(.headline)
            if let code = viewModel.inviteCode {
                Text(code)
                    .font(.system(size: 40, weight: .bold, design: .rounded))
                    .accessibilityLabel("Gezinscode \(code)")
            }
            Text("Houd deze code bij het kindertoestel. \(viewModel.createdChildName ?? "Je kind") kan nu koppelen met de pincode die je net koos.")
                .foregroundStyle(palette.mutedText.color)
        }

        Button("Ga naar kind-koppelen") {
            appState.openChildPairing()
        }
        .buttonStyle(.borderedProminent)
        .tint(palette.accent.color)
    }
}
