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
    @State private var goalViewModel: FamilyGoalViewModel?
    @State private var avatarShopViewModel: AvatarShopViewModel?

    var body: some View {
        @Bindable var appState = appState
        let session = appState.authStore.childSession
        let isTeen = session?.ageBand == .teen
        let isYoung = session?.ageBand == .young
        let palette = isTeen ? THPalettes.teen : THPalettes.kid

        TabView(selection: $appState.selectedChildTab) {
            MijnDagTabView(
                palette: palette,
                isTeen: isTeen,
                isYoung: isYoung,
                reduceMotion: reduceMotion,
                viewModel: dayViewModel,
                goalViewModel: goalViewModel
            )
            .tabItem {
                Label(
                    isYoung ? String(localized: "child.tab.day.young") : String(localized: "child.tab.day"),
                    systemImage: "checklist"
                )
            }
            .tag(ChildTab.mijnDag)

            WinkelTabView(palette: palette, isTeen: isTeen, isYoung: isYoung, viewModel: shopViewModel)
                .tabItem {
                    Label(
                        isYoung ? String(localized: "child.tab.shop.young") : String(localized: "child.tab.shop"),
                        systemImage: "gift.fill"
                    )
                }
                .tag(ChildTab.winkel)

            MijnHeldTabView(
                palette: palette,
                isYoung: isYoung,
                displayName: session?.displayName ?? String(localized: "held.fallback.name"),
                avatar: session?.avatar ?? "🦊",
                balance: dayViewModel?.state,
                avatarShopViewModel: avatarShopViewModel
            )
            .tabItem {
                Label(
                    isYoung ? String(localized: "child.tab.hero.young") : String(localized: "child.tab.hero"),
                    systemImage: "sparkles"
                )
            }
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
            if goalViewModel == nil {
                goalViewModel = FamilyGoalViewModel(apiClient: appState.apiClient)
            }
            if avatarShopViewModel == nil, let childID = session?.childID {
                avatarShopViewModel = AvatarShopViewModel(apiClient: appState.apiClient, memberID: childID)
            }
            await dayViewModel?.load()
            await shopViewModel?.load()
            await goalViewModel?.load()
            await registerPushIfNeeded()
        }
        .overlay {
            ConfettiOverlay(token: appState.celebrationService.confettiToken)
        }
        .overlay(alignment: .top) {
            if appState.mutationQueue.hasPendingWork || appState.syncEngine.isSyncing {
                THBadge(text: String(localized: "child.offline.safe"), palette: palette)
                    .padding(.top, THSpacing.sm)
            }
        }
        .sheet(isPresented: Binding(
            get: { appState.parentGate.isChallengePresented },
            set: { isPresented in
                if !isPresented {
                    appState.parentGate.closeGate()
                }
            }
        )) {
            ParentGateView()
                .presentationDetents([.medium])
        }
        .fullScreenCover(isPresented: Binding(
            get: { appState.parentGate.isParentModePresented },
            set: { isPresented in
                if !isPresented {
                    appState.closeParentMode()
                }
            }
        )) {
            ParentModeRootView()
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
    let isYoung: Bool
    let reduceMotion: Bool
    let viewModel: ChildDayViewModel?
    let goalViewModel: FamilyGoalViewModel?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: THSpacing.lg) {
                    if let progress = goalViewModel?.progress {
                        FamilyGoalCard(
                            progress: progress,
                            palette: palette,
                            isYoung: isYoung,
                            isTeen: isTeen
                        )
                    }
                    switch viewModel?.state {
                    case .loading, .none:
                        ProgressView(String(localized: "child.day.loading"))
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
                            HStack {
                                Text(LocalizedStringKey(isTeen ? "child.all.done.teen" : "child.all.done"))
                                    .font(.headline)
                                    .foregroundStyle(palette.text.color)
                                if isYoung {
                                    YoungSpeakButton(
                                        text: String(localized: "child.all.done"),
                                        palette: palette
                                    )
                                }
                            }
                            Text(LocalizedStringKey("child.all.done.detail"))
                                .foregroundStyle(palette.mutedText.color)
                        }
                    case .emptyNoTasks:
                        THCard(palette: palette) {
                            Text(LocalizedStringKey("child.no.missions"))
                                .font(.headline)
                                .foregroundStyle(palette.text.color)
                            Text(LocalizedStringKey("child.no.missions.detail"))
                                .foregroundStyle(palette.mutedText.color)
                            if isYoung {
                                YoungSpeakButton(
                                    text: String(localized: "child.no.missions.detail"),
                                    palette: palette
                                )
                            }
                        }
                    case .offline:
                        THCard(palette: palette) {
                            Text(LocalizedStringKey("child.connection.safe"))
                                .foregroundStyle(palette.text.color)
                        }
                    case .error(let message):
                        THCard(palette: palette) {
                            Text(message)
                                .foregroundStyle(palette.text.color)
                            Button(String(localized: "child.retry")) {
                                Task { await viewModel?.load() }
                            }
                            .frame(minHeight: isYoung ? YoungModeSupport.minTapTarget : 44)
                        }
                    }
                }
                .padding(THSpacing.xl)
            }
            .background(palette.background.color.ignoresSafeArea())
            .refreshable {
                await viewModel?.load()
                await goalViewModel?.load()
            }
        }
    }

    @ViewBuilder
    private func header(balance: TodayBalanceDTO) -> some View {
        THCard(palette: palette) {
            HStack {
                VStack(alignment: .leading) {
                    Text(LocalizedStringKey("child.day.title"))
                        .font(.system(size: isYoung ? 32 : 28, weight: .bold, design: .rounded))
                        .foregroundStyle(palette.text.color)
                    Text(String(
                        format: String(localized: "child.day.progress"),
                        balance.todayCompleted,
                        balance.todayTotal
                    ))
                    .foregroundStyle(palette.mutedText.color)
                }
                Spacer()
                THBadge(
                    text: String(format: String(localized: "child.points.badge"), balance.balance),
                    palette: palette
                )
                if isYoung {
                    YoungSpeakButton(
                        text: String(format: String(localized: "child.day.speak"), balance.todayCompleted, balance.todayTotal),
                        palette: palette
                    )
                }
            }
            THBadge(
                text: isTeen
                    ? String(format: String(localized: "child.streak.teen"), balance.streakDays)
                    : String(format: String(localized: "child.streak"), balance.streakDays),
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
                        .font(isYoung ? .title2.bold() : .headline)
                        .foregroundStyle(palette.text.color)
                    Text(String(format: String(localized: "child.task.points"), instance.points))
                        .foregroundStyle(palette.mutedText.color)
                    if let photoStatus = instance.photoStatus {
                        Text(LocalizedStringKey(
                            photoStatus == "ready" ? "child.photo.ready" : "child.photo.processing"
                        ))
                        .font(.footnote)
                        .foregroundStyle(palette.mutedText.color)
                    } else if isDone, instance.photoBonusPoints > 0, instance.photoId == nil {
                        Text(String(format: String(localized: "child.photo.bonus.hint"), instance.photoBonusPoints))
                            .font(.footnote)
                            .foregroundStyle(palette.mutedText.color)
                    }
                }
                Spacer()
                if isYoung {
                    YoungSpeakButton(text: instance.title, palette: palette)
                }
                if isDone {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title)
                        .foregroundStyle(palette.accent.color)
                        .accessibilityLabel(Text("child.task.done"))
                } else if isYoung {
                    YoungPrimaryButton(titleKey: "child.task.done.button", systemImage: "checkmark") {
                        Task { await viewModel?.complete(instanceID: instance.id, reduceMotion: reduceMotion) }
                    }
                } else {
                    Button(String(localized: "child.task.done.button")) {
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
    let isYoung: Bool
    let viewModel: ChildShopViewModel?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: THSpacing.lg) {
                    if viewModel?.isLoading == true {
                        ProgressView(String(localized: "child.shop.loading"))
                    } else if let rewards = viewModel?.rewards {
                        THCard(palette: palette) {
                            HStack {
                                Text(LocalizedStringKey("child.shop.title"))
                                    .font(.system(size: isYoung ? 32 : 28, weight: .bold, design: .rounded))
                                    .foregroundStyle(palette.text.color)
                                if isYoung {
                                    YoungSpeakButton(
                                        text: String(format: String(localized: "child.shop.balance.speak"), rewards.balance),
                                        palette: palette
                                    )
                                }
                            }
                            Text(String(format: String(localized: "child.shop.balance"), rewards.balance))
                                .foregroundStyle(palette.mutedText.color)
                        }

                        if rewards.rewards.isEmpty {
                            THCard(palette: palette) {
                                Text(LocalizedStringKey("child.shop.empty"))
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
                                                .font(.system(size: isYoung ? 36 : 28))
                                        }
                                        VStack(alignment: .leading) {
                                            Text(reward.title)
                                                .foregroundStyle(palette.text.color)
                                            if reward.affordable {
                                                Text(LocalizedStringKey(isTeen ? "child.shop.affordable.teen" : "child.shop.affordable"))
                                                    .font(.footnote)
                                                    .foregroundStyle(palette.mutedText.color)
                                            } else {
                                                Text(String(
                                                    format: String(localized: "child.shop.need.more"),
                                                    max(0, reward.price - rewards.balance),
                                                    reward.title
                                                ))
                                                .font(.footnote)
                                                .foregroundStyle(palette.mutedText.color)
                                            }
                                        }
                                        Spacer()
                                        THBadge(
                                            text: String(format: String(localized: "child.points.badge"), reward.price),
                                            palette: palette
                                        )
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
    let isYoung: Bool
    let displayName: String
    let avatar: String
    let balance: ChildDayLoadState?
    let avatarShopViewModel: AvatarShopViewModel?

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
                                .font(.system(size: isYoung ? 72 : 56))
                                .accessibilityLabel(Text("held.avatar.preview"))
                            HStack {
                                Text(displayName)
                                    .font(.system(size: isYoung ? 32 : 28, weight: .bold, design: .rounded))
                                    .foregroundStyle(palette.text.color)
                                if isYoung {
                                    YoungSpeakButton(text: displayName, palette: palette)
                                }
                            }
                            if let heroBalance {
                                Text(String(
                                    format: String(localized: "held.level.format"),
                                    max(1, heroBalance.lifetimeEarned / 100)
                                ))
                                .foregroundStyle(palette.mutedText.color)
                                Text(String(
                                    format: String(localized: "held.lifetime.format"),
                                    heroBalance.lifetimeEarned,
                                    heroBalance.streakDays
                                ))
                                .font(.footnote)
                                .foregroundStyle(palette.mutedText.color)
                            } else {
                                Text(LocalizedStringKey("held.level.explain"))
                                    .foregroundStyle(palette.mutedText.color)
                            }
                        }
                    }

                    if let avatarShopViewModel {
                        AvatarShopView(
                            viewModel: avatarShopViewModel,
                            palette: palette,
                            baseAvatar: avatar,
                            isYoung: isYoung
                        )
                    }
                }
                .padding(THSpacing.xl)
            }
            .background(palette.background.color.ignoresSafeArea())
            .onLongPressGesture(minimumDuration: 1.5) {
                appState.openParentGate(from: .heroWordmarkLongPress)
            }
            .onTapGesture(count: 5) {
                appState.openParentGate(from: .buildNumberFiveTap)
            }
            .accessibilityHint(Text("held.parent.gate.hint"))
        }
    }
}
