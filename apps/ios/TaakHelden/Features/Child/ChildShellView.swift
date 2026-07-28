import SwiftUI
import UIKit
import UserNotifications

enum ChildTab: Hashable {
    case mijnDag
    case winkel
    case mijnHeld
}

struct ChildShellView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var dayViewModel: ChildDayViewModel?
    @State private var shopViewModel: ChildShopViewModel?

    var body: some View {
        @Bindable var appState = appState
        let session = appState.authStore.childSession
        let isTeen = session?.ageBand == .teen
        let palette = isTeen ? THPalettes.teen : THPalettes.kid

        TabView(selection: $appState.selectedChildTab) {
            MijnDagTabView(
                palette: palette,
                isTeen: isTeen,
                reduceMotion: reduceMotion,
                viewModel: dayViewModel
            )
            .tabItem { Label("Mijn Dag", systemImage: "checklist") }
            .tag(ChildTab.mijnDag)

            WinkelTabView(palette: palette, isTeen: isTeen, viewModel: shopViewModel)
                .tabItem { Label("Winkel", systemImage: "gift.fill") }
                .tag(ChildTab.winkel)

            MijnHeldTabView(
                palette: palette,
                displayName: session?.displayName ?? "Held",
                avatar: session?.avatar ?? "🦊",
                balance: dayViewModel?.state
            )
            .tabItem { Label("Mijn Held", systemImage: "sparkles") }
            .tag(ChildTab.mijnHeld)
        }
        .task {
            if dayViewModel == nil {
                dayViewModel = ChildDayViewModel(
                    apiClient: appState.apiClient,
                    mutationQueue: appState.mutationQueue,
                    syncEngine: appState.syncEngine,
                    celebrationService: appState.celebrationService,
                    photoBonusService: appState.photoBonusService
                )
            }
            if shopViewModel == nil {
                shopViewModel = ChildShopViewModel(apiClient: appState.apiClient)
            }
            await dayViewModel?.load()
            await shopViewModel?.load()
            await registerPushIfNeeded()
        }
        .overlay {
            ConfettiOverlay(token: appState.celebrationService.confettiToken)
        }
        .overlay(alignment: .top) {
            if appState.mutationQueue.hasPendingWork || appState.syncEngine.isSyncing {
                THBadge(text: "Wordt bewaard — sturen we zo", palette: palette)
                    .padding(.top, THSpacing.sm)
            }
        }
        .sheet(isPresented: Binding(
            get: { appState.parentGate.isParentSheetPresented },
            set: { isPresented in
                if !isPresented {
                    appState.parentGate.closeGate()
                }
            }
        )) {
            ParentGateView()
                .presentationDetents([.medium])
        }
    }

    @MainActor
    private func registerPushIfNeeded() async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        if settings.authorizationStatus == .notDetermined {
            _ = try? await center.requestAuthorization(options: [.alert, .badge, .sound])
        }
        await UIApplication.shared.registerForRemoteNotifications()
        await appState.pushService.registerIfNeeded(tokenProvider: APNSTokenStore.shared)
    }
}

private struct MijnDagTabView: View {
    @Environment(AppState.self) private var appState

    let palette: THPalette
    let isTeen: Bool
    let reduceMotion: Bool
    let viewModel: ChildDayViewModel?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: THSpacing.lg) {
                    switch viewModel?.state {
                    case .loading, .none:
                        ProgressView("Even je heldendag laden…")
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.top, THSpacing.xxl)
                    case .ready(let today):
                        header(balance: today.balance)
                        ForEach(today.instances) { instance in
                            taskCard(instance)
                        }
                    case .emptyAllDone(let balance):
                        header(balance: balance)
                        THCard(palette: palette) {
                            Text(isTeen
                                  ? "Alles gedaan — nette dag."
                                  : "Alles gedaan — je bent vandaag al een TaakHeld! 🌟")
                                .font(.headline)
                                .foregroundStyle(palette.text.color)
                            Text("Morgen staan er weer nieuwe missies klaar.")
                                .foregroundStyle(palette.mutedText.color)
                        }
                    case .emptyNoTasks:
                        THCard(palette: palette) {
                            Text("Nog geen missies")
                                .font(.headline)
                                .foregroundStyle(palette.text.color)
                            Text("Vraag papa of mama even om er eentje klaar te zetten.")
                                .foregroundStyle(palette.mutedText.color)
                        }
                    case .offline:
                        THCard(palette: palette) {
                            Text("We kunnen even geen verbinding maken — je afgevinkte taken zijn veilig.")
                                .foregroundStyle(palette.text.color)
                        }
                    case .error(let message):
                        THCard(palette: palette) {
                            Text(message)
                                .foregroundStyle(palette.text.color)
                            Button("Opnieuw proberen") {
                                Task { await viewModel?.load() }
                            }
                        }
                    }
                }
                .padding(THSpacing.xl)
            }
            .background(palette.background.color.ignoresSafeArea())
            .refreshable {
                await viewModel?.load()
            }
        }
    }

    @ViewBuilder
    private func header(balance: TodayBalanceDTO) -> some View {
        THCard(palette: palette) {
            HStack {
                VStack(alignment: .leading) {
                    Text("Vandaag")
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .foregroundStyle(palette.text.color)
                    Text("\(balance.todayCompleted) van \(balance.todayTotal) klaar")
                        .foregroundStyle(palette.mutedText.color)
                }
                Spacer()
                THBadge(text: "\(balance.balance) punten", palette: palette)
            }
            THBadge(
                text: isTeen
                    ? "\(balance.streakDays) dagen streak"
                    : "🔥 \(balance.streakDays) dagen streak",
                palette: palette
            )
        }
    }

    @ViewBuilder
    private func taskCard(_ instance: InstanceViewDTO) -> some View {
        let isDone = instance.status != "open" && instance.status != "open_redo"
        THCard(palette: palette) {
            HStack {
                VStack(alignment: .leading, spacing: THSpacing.sm) {
                    Label(instance.title, systemImage: "sparkles")
                        .font(.headline)
                        .foregroundStyle(palette.text.color)
                    Text("+\(instance.points) punten")
                        .foregroundStyle(palette.mutedText.color)
                    if let photoStatus = instance.photoStatus {
                        Text(photoStatus == "ready" ? "Foto is klaar — bonus volgt na goedkeuring!" : "Foto wordt nagekeken…")
                            .font(.footnote)
                            .foregroundStyle(palette.mutedText.color)
                    } else if isDone, instance.photoBonusPoints > 0, instance.photoId == nil {
                        Text("+\(instance.photoBonusPoints) bonuspunten met een foto")
                            .font(.footnote)
                            .foregroundStyle(palette.mutedText.color)
                    }
                }
                Spacer()
                if isDone {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title)
                        .foregroundStyle(palette.accent.color)
                        .accessibilityLabel("Afgevinkt")
                } else {
                    Button("Klaar!") {
                        Task { await viewModel?.complete(instanceID: instance.id, reduceMotion: reduceMotion) }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(palette.accent.color)
                }
            }

            if isDone, instance.photoBonusPoints > 0, instance.photoId == nil {
                PhotoBonusActionsView(palette: palette) { jpegData in
                    Task { await viewModel?.uploadPhoto(for: instance.id, jpegData: jpegData) }
                }
            }
        }
        .opacity(isDone ? 0.85 : 1)
    }
}

private struct WinkelTabView: View {
    let palette: THPalette
    let isTeen: Bool
    let viewModel: ChildShopViewModel?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: THSpacing.lg) {
                    if viewModel?.isLoading == true {
                        ProgressView("Winkel laden…")
                    } else if let rewards = viewModel?.rewards {
                        THCard(palette: palette) {
                            Text("Winkel")
                                .font(.system(size: 28, weight: .bold, design: .rounded))
                                .foregroundStyle(palette.text.color)
                            Text("Je hebt \(rewards.balance) punten")
                                .foregroundStyle(palette.mutedText.color)
                        }

                        if rewards.rewards.isEmpty {
                            THCard(palette: palette) {
                                Text("Straks staan hier beloningen klaar — pap of mam vult de winkel.")
                                    .foregroundStyle(palette.text.color)
                            }
                        } else {
                            ForEach(rewards.rewards) { reward in
                                THCard(palette: palette) {
                                    HStack {
                                        if isTeen {
                                            Image(systemName: "gift")
                                                .font(.system(size: 24, weight: .semibold))
                                                .foregroundStyle(palette.accent.color)
                                        } else {
                                            Text(reward.icon ?? "🎁")
                                                .font(.system(size: 28))
                                        }
                                        VStack(alignment: .leading) {
                                            Text(reward.title)
                                                .foregroundStyle(palette.text.color)
                                            if reward.affordable {
                                                Text(isTeen ? "Past bij je saldo" : "Je kunt deze kiezen!")
                                                    .font(.footnote)
                                                    .foregroundStyle(palette.mutedText.color)
                                            } else {
                                                Text("Nog \(max(0, reward.price - rewards.balance)) punten tot \(reward.title)")
                                                    .font(.footnote)
                                                    .foregroundStyle(palette.mutedText.color)
                                            }
                                        }
                                        Spacer()
                                        THBadge(text: "\(reward.price) punten", palette: palette)
                                    }
                                }
                                .opacity(reward.affordable ? 1 : 0.75)
                            }
                        }
                    } else if let error = viewModel?.errorMessage {
                        THCard(palette: palette) {
                            Text(error)
                                .foregroundStyle(palette.text.color)
                        }
                    }
                }
                .padding(THSpacing.xl)
            }
            .background(palette.background.color.ignoresSafeArea())
            .refreshable { await viewModel?.load() }
        }
    }
}

private struct MijnHeldTabView: View {
    @Environment(AppState.self) private var appState

    let palette: THPalette
    let displayName: String
    let avatar: String
    let balance: ChildDayLoadState?

    var body: some View {
        let heroBalance: TodayBalanceDTO? = {
            if case .ready(let today) = balance { return today.balance }
            if case .emptyAllDone(let b) = balance { return b }
            return nil
        }()

        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: THSpacing.lg) {
                    THCard(palette: palette) {
                        VStack(alignment: .leading, spacing: THSpacing.md) {
                            Text(avatar)
                                .font(.system(size: 56))
                                .accessibilityLabel("Avatar")
                            Text(displayName)
                                .font(.system(size: 28, weight: .bold, design: .rounded))
                                .foregroundStyle(palette.text.color)
                            if let heroBalance {
                                Text("Level \(max(1, heroBalance.lifetimeEarned / 100))")
                                    .foregroundStyle(palette.mutedText.color)
                                Text("Alles bij elkaar: \(heroBalance.lifetimeEarned) punten · streak \(heroBalance.streakDays)")
                                    .font(.footnote)
                                    .foregroundStyle(palette.mutedText.color)
                            } else {
                                Text("Je level groeit mee met alle punten die je ooit hebt verdiend — niet met je huidige saldo.")
                                    .foregroundStyle(palette.mutedText.color)
                            }
                        }
                    }
                }
                .padding(THSpacing.xl)
            }
            .background(palette.background.color.ignoresSafeArea())
            .onLongPressGesture(minimumDuration: 1.5) {
                appState.parentGate.openGate()
            }
            .onTapGesture(count: 5) {
                appState.parentGate.openGate()
            }
            .accessibilityHint("Houd lang vast om de ouderpoort te openen")
        }
    }
}
