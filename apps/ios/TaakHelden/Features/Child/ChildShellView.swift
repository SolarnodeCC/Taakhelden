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
    @State private var showPushPrimer = false

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
                avatar: session?.avatar ?? "🦊",
                displayName: session?.displayName ?? String(localized: "held.fallback.name"),
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

            WinkelTabView(
                palette: palette,
                isTeen: isTeen,
                isYoung: isYoung,
                reduceMotion: reduceMotion,
                viewModel: shopViewModel
            )
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
                shopViewModel = ChildShopViewModel(
                    apiClient: appState.apiClient,
                    mutationQueue: appState.mutationQueue,
                    syncEngine: appState.syncEngine,
                    celebrationService: appState.celebrationService
                )
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
            await preparePushOptIn()
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
        .sheet(isPresented: $showPushPrimer) {
            PushOptInPrimerSheet(palette: palette) {
                showPushPrimer = false
                Task { await requestPushAuthorization() }
            } onDecline: {
                showPushPrimer = false
            }
            .presentationDetents([.medium])
        }
    }

    /// Show an in-app explanation before the system permission dialog (Guideline 5.1.1).
    @MainActor
    private func preparePushOptIn() async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        switch settings.authorizationStatus {
        case .notDetermined:
            showPushPrimer = true
        case .authorized, .provisional, .ephemeral:
            await UIApplication.shared.registerForRemoteNotifications()
            await appState.pushService.registerIfNeeded(tokenProvider: APNSTokenStore.shared)
        default:
            break
        }
    }

    @MainActor
    private func requestPushAuthorization() async {
        let center = UNUserNotificationCenter.current()
        _ = try? await center.requestAuthorization(options: [.alert, .badge, .sound])
        await UIApplication.shared.registerForRemoteNotifications()
        await appState.pushService.registerIfNeeded(tokenProvider: APNSTokenStore.shared)
    }
}

/// Pre-permission primer so children/parents understand why we ask (HIG + 5.1.1).
private struct PushOptInPrimerSheet: View {
    let palette: THPalette
    let onAccept: () -> Void
    let onDecline: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: THSpacing.lg) {
            Text(LocalizedStringKey("child.push.primer.title"))
                .font(.title2.bold())
                .foregroundStyle(palette.text.color)
            Text(LocalizedStringKey("child.push.primer.body"))
                .foregroundStyle(palette.mutedText.color)
            Spacer(minLength: THSpacing.md)
            Button(action: onAccept) {
                Text(LocalizedStringKey("child.push.primer.accept"))
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(palette.accent.color)
            Button(action: onDecline) {
                Text(LocalizedStringKey("child.push.primer.decline"))
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
        }
        .padding(THSpacing.xl)
        .background(palette.background.color.ignoresSafeArea())
    }
}

private struct MijnDagTabView: View {
    @Environment(AppState.self) private var appState

    let palette: THPalette
    let isTeen: Bool
    let isYoung: Bool
    let reduceMotion: Bool
    let avatar: String
    let displayName: String
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
                    if let msg = viewModel?.undoStatusMessage {
                        Text(msg)
                            .font(.footnote)
                            .foregroundStyle(palette.mutedText.color)
                            .frame(maxWidth: .infinity, alignment: .leading)
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
            HStack(alignment: .center, spacing: THSpacing.md) {
                Text(avatar)
                    .font(.system(size: isYoung ? 56 : 44))
                    .accessibilityLabel(Text(displayName))

                VStack(alignment: .leading, spacing: THSpacing.xs) {
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

                Spacer(minLength: THSpacing.sm)

                VStack(alignment: .trailing, spacing: THSpacing.sm) {
                    THBadge(
                        text: String(format: String(localized: "child.points.badge"), balance.balance),
                        palette: palette
                    )
                    THBadge(
                        text: isTeen
                            ? String(format: String(localized: "child.streak.teen"), balance.streakDays)
                            : String(format: String(localized: "child.streak"), balance.streakDays),
                        palette: palette
                    )
                    if isYoung {
                        YoungSpeakButton(
                            text: String(
                                format: String(localized: "child.day.speak"),
                                balance.todayCompleted,
                                balance.todayTotal
                            ),
                            palette: palette
                        )
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func taskCard(_ instance: InstanceViewDTO) -> some View {
        let isDone = instance.status != "open" && instance.status != "open_redo"
        // Show undo affordance only when: completed this session, within 5-min window,
        // and not yet approved (approved instances cannot be undone server-side).
        let canUndo = isDone
            && instance.status != "approved"
            && viewModel?.isInUndoWindow(instance.id) == true

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
                    YoungPrimaryButton(
                        titleKey: "child.task.done.button",
                        systemImage: "checkmark",
                        palette: palette
                    ) {
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

            // "Oeps, toch niet" — undo affordance within the 5-minute server window.
            if canUndo {
                Button(String(localized: "child.task.undo.button")) {
                    Task { await viewModel?.undo(instanceID: instance.id) }
                }
                .buttonStyle(.bordered)
                .foregroundStyle(palette.mutedText.color)
                .frame(maxWidth: .infinity, minHeight: isYoung ? YoungModeSupport.minTapTarget : 44)
                .accessibilityLabel(Text("child.task.undo.button"))
            }
        }
        .opacity(isDone ? 0.85 : 1)
    }
}

private struct WinkelTabView: View {
    let palette: THPalette
    let isTeen: Bool
    let isYoung: Bool
    let reduceMotion: Bool
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
                                        text: String(
                                            format: String(localized: "child.shop.balance.speak"),
                                            rewards.balance
                                        ),
                                        palette: palette
                                    )
                                }
                            }
                            Text(String(format: String(localized: "child.shop.balance"), rewards.balance))
                                .foregroundStyle(palette.mutedText.color)
                        }

                        if let status = viewModel?.statusMessage {
                            Text(status)
                                .font(.footnote)
                                .foregroundStyle(palette.mutedText.color)
                        }

                        if let goal = rewards.savingsGoal {
                            SavingsGoalCard(goal: goal, balance: rewards.balance, palette: palette, isTeen: isTeen)
                        }

                        if let pending = viewModel?.pendingRedemptions, !pending.isEmpty {
                            ForEach(pending) { redemption in
                                THCard(palette: palette) {
                                    HStack {
                                        Text(redemption.icon ?? "🎁")
                                            .font(.system(size: 28))
                                        VStack(alignment: .leading, spacing: THSpacing.xs) {
                                            Text(redemption.title)
                                                .foregroundStyle(palette.text.color)
                                            Text(LocalizedStringKey("child.shop.pending"))
                                                .font(.footnote)
                                                .foregroundStyle(palette.mutedText.color)
                                        }
                                        Spacer()
                                        THBadge(
                                            text: String(
                                                format: String(localized: "child.points.badge"),
                                                redemption.price
                                            ),
                                            palette: palette
                                        )
                                    }
                                }
                            }
                        }

                        if rewards.rewards.isEmpty {
                            THCard(palette: palette) {
                                Text(LocalizedStringKey("child.shop.empty"))
                                    .foregroundStyle(palette.text.color)
                            }
                        } else {
                            ForEach(rewards.rewards) { reward in
                                RewardShopCard(
                                    reward: reward,
                                    balance: rewards.balance,
                                    palette: palette,
                                    isTeen: isTeen,
                                    isYoung: isYoung,
                                    isRedeeming: viewModel?.redeemingRewardID == reward.id,
                                    isPinning: viewModel?.pinningRewardID == reward.id
                                ) {
                                    Task {
                                        await viewModel?.redeem(rewardID: reward.id, reduceMotion: reduceMotion)
                                    }
                                } onPin: {
                                    Task { await viewModel?.pin(rewardID: reward.id) }
                                }
                            }
                        }
                    } else if let error = viewModel?.errorMessage {
                        THCard(palette: palette) {
                            Text(error)
                                .foregroundStyle(palette.text.color)
                            Button(String(localized: "child.retry")) {
                                Task { await viewModel?.load() }
                            }
                            .buttonStyle(.bordered)
                            .frame(minHeight: isYoung ? YoungModeSupport.minTapTarget : 44)
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

private struct SavingsGoalCard: View {
    let goal: SavingsGoalViewDTO
    let balance: Int
    let palette: THPalette
    let isTeen: Bool

    private var remaining: Int {
        max(0, goal.price - balance)
    }

    var body: some View {
        THCard(palette: palette) {
            HStack(alignment: .top, spacing: THSpacing.md) {
                Text(goal.icon ?? "🎯")
                    .font(.system(size: 28))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: THSpacing.sm) {
                    Text(LocalizedStringKey("child.shop.pinned"))
                        .font(.headline)
                        .foregroundStyle(palette.text.color)
                    Text(goal.title)
                        .foregroundStyle(palette.text.color)
                    ProgressView(value: min(1, max(0, goal.progress)))
                        .tint(palette.accent.color)
                        .accessibilityHidden(true)
                    Text(String(
                        format: String(localized: isTeen ? "child.shop.goal.progress.teen" : "child.shop.goal.progress"),
                        remaining,
                        goal.title
                    ))
                    .font(.footnote)
                    .foregroundStyle(palette.mutedText.color)
                }
            }
        }
    }
}

private struct RewardShopCard: View {
    let reward: ChildRewardViewDTO
    let balance: Int
    let palette: THPalette
    let isTeen: Bool
    let isYoung: Bool
    let isRedeeming: Bool
    let isPinning: Bool
    let onRedeem: () -> Void
    let onPin: () -> Void

    var body: some View {
        THCard(palette: palette) {
            HStack(alignment: .top) {
                if isTeen {
                    Image(systemName: "gift")
                        .font(.system(size: 24, weight: .semibold))
                        .foregroundStyle(palette.accent.color)
                } else {
                    Text(reward.icon ?? "🎁")
                        .font(.system(size: isYoung ? 36 : 28))
                }
                VStack(alignment: .leading, spacing: THSpacing.xs) {
                    Text(reward.title)
                        .foregroundStyle(palette.text.color)
                    if reward.pinned {
                        Text(LocalizedStringKey("child.shop.pinned"))
                            .font(.footnote)
                            .foregroundStyle(palette.accent.color)
                    } else if reward.affordable {
                        Text(LocalizedStringKey(isTeen ? "child.shop.affordable.teen" : "child.shop.affordable"))
                            .font(.footnote)
                            .foregroundStyle(palette.mutedText.color)
                    } else {
                        Text(String(
                            format: String(localized: "child.shop.need.more"),
                            max(0, reward.price - balance),
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

            HStack(spacing: THSpacing.sm) {
                if !reward.pinned {
                    Button(String(localized: "child.shop.pin")) {
                        onPin()
                    }
                    .buttonStyle(.bordered)
                    .disabled(isPinning || isRedeeming)
                    .frame(minHeight: isYoung ? YoungModeSupport.minTapTarget : 44)
                }

                Spacer(minLength: 0)

                if reward.affordable {
                    if isYoung {
                        YoungPrimaryButton(
                            titleKey: "child.shop.redeem.young",
                            systemImage: "cart.fill",
                            palette: palette
                        ) {
                            onRedeem()
                        }
                        .disabled(isRedeeming || isPinning)
                    } else {
                        Button(String(localized: "child.shop.redeem")) {
                            onRedeem()
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(palette.accent.color)
                        .disabled(isRedeeming || isPinning)
                        .frame(minHeight: 44)
                    }
                }
            }
        }
        .opacity(reward.affordable || reward.pinned ? 1 : 0.75)
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
                                .accessibilityAction(named: Text("held.parent.gate.action")) {
                                    appState.openParentGate(from: .heroWordmarkLongPress)
                                }
                            HStack {
                                Text(displayName)
                                    .font(.system(size: isYoung ? 32 : 28, weight: .bold, design: .rounded))
                                    .foregroundStyle(palette.text.color)
                                if isYoung {
                                    YoungSpeakButton(text: displayName, palette: palette)
                                }
                            }
                            if let heroBalance {
                                let level = avatarShopViewModel?.state?.level
                                    ?? HeroProgress.level(fromLifetime: heroBalance.lifetimeEarned)
                                Text(String(format: String(localized: "held.level.format"), level))
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

                    // Discoverable parent-gate hint (no permanent Ouder tab — ADR-0003).
                    Text(LocalizedStringKey("held.parent.gate.hint"))
                        .font(.footnote)
                        .foregroundStyle(palette.mutedText.color)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .accessibilityHint(Text("held.parent.gate.action"))
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
        }
    }
}
