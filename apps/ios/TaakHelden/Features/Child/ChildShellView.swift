import SwiftUI

enum ChildTab: Hashable {
    case mijnDag
    case winkel
    case mijnHeld
}

struct ChildShellView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let session = appState.authStore.childSession
        let palette = session?.ageBand == .teen ? THPalettes.teen : THPalettes.kid

        TabView(selection: $appState.selectedChildTab) {
            MijnDagTabView(palette: palette, reduceMotion: reduceMotion)
                .tabItem { Label("Mijn Dag", systemImage: "checklist") }
                .tag(ChildTab.mijnDag)

            WinkelTabView(palette: palette)
                .tabItem { Label("Winkel", systemImage: "gift.fill") }
                .tag(ChildTab.winkel)

            MijnHeldTabView(
                palette: palette,
                displayName: session?.displayName ?? "Held",
                avatar: session?.avatar ?? "🦊"
            )
            .tabItem { Label("Mijn Held", systemImage: "sparkles") }
            .tag(ChildTab.mijnHeld)
        }
        .sheet(isPresented: Binding(
            get: { appState.parentGate.isParentSheetPresented },
            set: { isPresented in
                if !isPresented {
                    appState.parentGate.closeGate()
                }
            }
        )) {
            ParentGateSheet()
                .presentationDetents([.medium])
        }
    }
}

private struct MijnDagTabView: View {
    let palette: THPalette
    let reduceMotion: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: THSpacing.lg) {
                    THCard(palette: palette) {
                        HStack {
                            VStack(alignment: .leading, spacing: THSpacing.sm) {
                                Text("Vandaag lukt al mooi")
                                    .font(.system(size: 28, weight: .bold, design: .rounded))
                                    .foregroundStyle(palette.text.color)
                                Text("Je eerste verticale slice staat klaar: tabs, positieve states en ruimte voor echte sync-data.")
                                    .foregroundStyle(palette.mutedText.color)
                            }
                            Spacer()
                            THBadge(text: "12 punten", palette: palette)
                        }

                        THBadge(text: "Wordt bewaard - sturen we zo", palette: palette)
                    }

                    THCard(palette: palette) {
                        Label("Kamer netjes maken", systemImage: "sparkles")
                            .font(.headline)
                            .foregroundStyle(palette.text.color)
                        Text("Klaar voor een vrolijk afvinkmoment.")
                            .foregroundStyle(palette.mutedText.color)
                        Text(reduceMotion ? "Bij succes tonen we een rustige glow + haptic." : "Bij succes is er ruimte voor confetti + haptic.")
                            .font(.footnote)
                            .foregroundStyle(palette.mutedText.color)
                    }

                    THCard(palette: palette) {
                        Text("Alles gedaan - je bent vandaag al een TaakHeld! 🌟")
                            .font(.headline)
                            .foregroundStyle(palette.text.color)
                        Text("Deze state is alvast ingebouwd zodat de kindervaring positief blijft, ook als de lijst leeg is.")
                            .foregroundStyle(palette.mutedText.color)
                    }
                }
                .padding(THSpacing.xl)
            }
            .background(palette.background.color.ignoresSafeArea())
        }
    }
}

private struct WinkelTabView: View {
    let palette: THPalette

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: THSpacing.lg) {
                    THCard(palette: palette) {
                        Text("Winkel")
                            .font(.system(size: 28, weight: .bold, design: .rounded))
                            .foregroundStyle(palette.text.color)
                        Text("Beloningen blijven vriendelijk leesbaar: niet 'te duur', maar 'nog 8 punten tot filmavond'.")
                            .foregroundStyle(palette.mutedText.color)
                    }

                    THCard(palette: palette) {
                        HStack {
                            Text("🎬")
                                .font(.system(size: 28))
                            VStack(alignment: .leading) {
                                Text("Filmavond kiezen")
                                    .foregroundStyle(palette.text.color)
                                Text("Nog 8 punten te gaan")
                                    .font(.footnote)
                                    .foregroundStyle(palette.mutedText.color)
                            }
                            Spacer()
                            THBadge(text: "18 punten", palette: palette)
                        }
                    }
                }
                .padding(THSpacing.xl)
            }
            .background(palette.background.color.ignoresSafeArea())
        }
    }
}

private struct MijnHeldTabView: View {
    @Environment(AppState.self) private var appState

    let palette: THPalette
    let displayName: String
    let avatar: String

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: THSpacing.lg) {
                    THCard(palette: palette) {
                        VStack(alignment: .leading, spacing: THSpacing.md) {
                            Text(avatar)
                                .font(.system(size: 56))
                            Text(displayName)
                                .font(.system(size: 28, weight: .bold, design: .rounded))
                                .foregroundStyle(palette.text.color)
                            Text("Level komt later uit lifetimeEarned, nooit uit het huidige saldo.")
                                .foregroundStyle(palette.mutedText.color)
                        }
                    }
                }
                .padding(THSpacing.xl)
            }
            .background(palette.background.color.ignoresSafeArea())
            .onLongPressGesture(minimumDuration: 1.5) {
                appState.parentGate.openGate()
            }
        }
    }
}

private struct ParentGateSheet: View {
    var body: some View {
        VStack(alignment: .leading, spacing: THSpacing.lg) {
            Text("Ouderpoort")
                .font(.title2.bold())
            Text("Hier komt de combinatie van LocalAuthentication en ouder-login. Kind-pincode opent dit scherm bewust niet.")
            Text("Push-links naar ouderacties landen ook eerst hier.")
                .foregroundStyle(.secondary)
        }
        .padding(THSpacing.xl)
    }
}
