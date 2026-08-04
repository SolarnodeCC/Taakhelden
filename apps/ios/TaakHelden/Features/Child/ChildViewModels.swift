import Foundation
import Observation

enum ChildDayLoadState: Equatable {
    case loading
    case ready(ChildTodayViewDTO)
    case emptyAllDone(TodayBalanceDTO)
    case emptyNoTasks
    /// Child has an active pause set by a parent — show a gentle rest state.
    case paused(String?)
    case offline
    case error(String)
}

@Observable
final class ChildDayViewModel {
    private let apiClient: TaakHeldenAPIClient
    private let mutationQueue: MutationQueue
    private let syncEngine: SyncEngine
    private let celebrationService: CelebrationService
    private let photoBonusService: PhotoBonusService

    var state: ChildDayLoadState = .loading
    var optimisticCompletedIDs: Set<String> = []

    /// Timestamps of completions made in this session, keyed by instance ID.
    /// Used to determine whether the 5-minute undo window is still open.
    private(set) var completionTimestamps: [String: Date] = [:]

    /// Friendly status message shown when an undo is rejected (e.g. window expired).
    var undoStatusMessage: String?

    /// Matches the server-side undo window (POST /instances/:id/undo — 5 min).
    private let undoWindowSeconds: TimeInterval = 300

    /// Returns true if the undo button should be offered for `instanceID`.
    func isInUndoWindow(_ instanceID: String) -> Bool {
        guard let stamp = completionTimestamps[instanceID] else { return false }
        return Date().timeIntervalSince(stamp) < undoWindowSeconds
    }

    init(
        apiClient: TaakHeldenAPIClient,
        mutationQueue: MutationQueue,
        syncEngine: SyncEngine,
        celebrationService: CelebrationService,
        photoBonusService: PhotoBonusService
    ) {
        self.apiClient = apiClient
        self.mutationQueue = mutationQueue
        self.syncEngine = syncEngine
        self.celebrationService = celebrationService
        self.photoBonusService = photoBonusService
    }

    @MainActor
    func load() async {
        undoStatusMessage = nil
        state = .loading
        do {
            // WS-PAUSE: check for an active child pause before loading tasks.
            // Requires the child session to have a childID available via the API client.
            if let memberID = apiClient.authStore.childSession?.childID {
                if let pause = try? await apiClient.fetchChildPause(memberID: memberID), pause.active {
                    // Prefer the parent-set reason (positive copy), fall back to generic.
                    state = .paused(pause.reason)
                    return
                }
            }
            let today = try await apiClient.fetchChildToday()
            if today.instances.isEmpty {
                state = today.balance.todayTotal == 0 ? .emptyNoTasks : .emptyAllDone(today.balance)
            } else {
                state = .ready(today)
            }
        } catch {
            if mutationQueue.hasPendingWork {
                state = .offline
            } else {
                state = .error(String(localized: "child.connection.safe"))
            }
        }
    }

    @MainActor
    func complete(instanceID: String, reduceMotion: Bool) async {
        let mutation = QueuedMutation(kind: .complete, targetID: instanceID)
        mutationQueue.enqueue(mutation)
        optimisticCompletedIDs.insert(instanceID)
        completionTimestamps[instanceID] = Date()
        celebrationService.celebrateTaskCompleted(reduceMotion: reduceMotion)

        _ = await syncEngine.syncNow()
        await load()
    }

    /// Undoes a just-completed task within the 5-minute server window.
    ///
    /// Uses a deterministic idempotency key so a retry after a dropped response
    /// never sends two undo ops for the same instance.
    @MainActor
    func undo(instanceID: String) async {
        let undoKey = "undo:\(instanceID)"
        let mutation = QueuedMutation(kind: .undo, targetID: instanceID, key: undoKey)
        mutationQueue.enqueue(mutation)
        optimisticCompletedIDs.remove(instanceID)
        completionTimestamps[instanceID] = nil

        let outcomes = await syncEngine.syncNow()
        if outcomes.contains(.undoWindowExpired) {
            undoStatusMessage = String(localized: "child.task.undo.expired")
        }
        await load()
    }

    @MainActor
    func uploadPhoto(for instanceID: String, jpegData: Data) async {
        do {
            try await photoBonusService.uploadTaskPhoto(instanceID: instanceID, jpegData: jpegData)
            await load()
        } catch {
            state = .error(String(localized: "child.photo.upload.error"))
        }
    }
}

@Observable
final class ChildShopViewModel {
    private let apiClient: TaakHeldenAPIClient
    private let mutationQueue: MutationQueue
    private let syncEngine: SyncEngine
    private let celebrationService: CelebrationService

    var rewards: ChildRewardsViewDTO?
    var redemptions: [RedemptionViewDTO] = []
    var isLoading = false
    var errorMessage: String?
    var statusMessage: String?
    var redeemingRewardID: String?
    var pinningRewardID: String?

    init(
        apiClient: TaakHeldenAPIClient,
        mutationQueue: MutationQueue,
        syncEngine: SyncEngine,
        celebrationService: CelebrationService
    ) {
        self.apiClient = apiClient
        self.mutationQueue = mutationQueue
        self.syncEngine = syncEngine
        self.celebrationService = celebrationService
    }

    var pendingRedemptions: [RedemptionViewDTO] {
        redemptions.filter { $0.status == "pending" }
    }

    @MainActor
    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            rewards = try await apiClient.fetchChildRewards()
            redemptions = try await apiClient.fetchChildRedemptions().redemptions
            errorMessage = nil
        } catch {
            errorMessage = String(localized: "child.shop.load.error")
        }
    }

    @MainActor
    func redeem(rewardID: String, reduceMotion: Bool) async {
        guard let current = rewards, let reward = current.rewards.first(where: { $0.id == rewardID }) else {
            return
        }
        guard reward.affordable else {
            statusMessage = String(localized: "child.shop.insufficient")
            return
        }
        guard redeemingRewardID == nil else { return }

        redeemingRewardID = rewardID
        defer { redeemingRewardID = nil }

        let mutation = QueuedMutation(kind: .redeem, targetID: rewardID)
        mutationQueue.enqueue(mutation)
        rewards = Self.applyingRedeemOptimism(to: current, rewardID: rewardID, price: reward.price)
        celebrationService.celebrateTaskCompleted(reduceMotion: reduceMotion)
        statusMessage = String(localized: "child.shop.redeem.success")

        let outcomes = await syncEngine.syncNow()
        if outcomes.contains(.insufficientPoints) {
            statusMessage = String(localized: "child.shop.insufficient")
        }
        await load()
    }

    @MainActor
    func pin(rewardID: String) async {
        guard rewards != nil else { return }
        guard pinningRewardID == nil else { return }

        pinningRewardID = rewardID
        defer { pinningRewardID = nil }

        do {
            let result = try await apiClient.pinReward(id: rewardID)
            if let current = rewards {
                rewards = Self.applyingPin(to: current, result: result, icon: current.rewards.first(where: { $0.id == rewardID })?.icon)
            }
            statusMessage = String(localized: "child.shop.pinned")
            await load()
        } catch {
            statusMessage = String(localized: "child.shop.pin.error")
        }
    }

    /// Optimistic balance/affordability after enqueueing a redeem (test seam).
    static func applyingRedeemOptimism(
        to current: ChildRewardsViewDTO,
        rewardID: String,
        price: Int
    ) -> ChildRewardsViewDTO {
        let newBalance = max(0, current.balance - price)
        let updatedRewards = current.rewards.map { reward in
            ChildRewardViewDTO(
                id: reward.id,
                title: reward.title,
                icon: reward.icon,
                price: reward.price,
                limitPerWeek: reward.limitPerWeek,
                affordable: newBalance >= reward.price,
                pinned: reward.pinned
            )
        }
        let goal: SavingsGoalViewDTO? = {
            guard let goal = current.savingsGoal else { return nil }
            return SavingsGoalViewDTO(
                rewardId: goal.rewardId,
                title: goal.title,
                icon: goal.icon,
                price: goal.price,
                progress: goal.price > 0 ? min(1, Double(newBalance) / Double(goal.price)) : 0
            )
        }()
        return ChildRewardsViewDTO(
            viewer: current.viewer,
            balance: newBalance,
            rewards: updatedRewards,
            savingsGoal: goal
        )
    }

    /// Optimistic pin + spaardoel card (test seam).
    static func applyingPin(
        to current: ChildRewardsViewDTO,
        result: PinRewardResultDTO,
        icon: String?
    ) -> ChildRewardsViewDTO {
        let updatedRewards = current.rewards.map { reward in
            ChildRewardViewDTO(
                id: reward.id,
                title: reward.title,
                icon: reward.icon,
                price: reward.price,
                limitPerWeek: reward.limitPerWeek,
                affordable: reward.affordable,
                pinned: reward.id == result.rewardId
            )
        }
        let goal = SavingsGoalViewDTO(
            rewardId: result.rewardId,
            title: result.title,
            icon: icon,
            price: result.price,
            progress: result.progress
        )
        return ChildRewardsViewDTO(
            viewer: current.viewer,
            balance: current.balance,
            rewards: updatedRewards,
            savingsGoal: goal
        )
    }
}

@Observable
final class ChildHeroViewModel {
    let displayName: String
    let avatar: String
    let lifetimeEarned: Int
    let streakDays: Int

    init(displayName: String, avatar: String, lifetimeEarned: Int, streakDays: Int) {
        self.displayName = displayName
        self.avatar = avatar
        self.lifetimeEarned = lifetimeEarned
        self.streakDays = streakDays
    }

    var level: Int {
        HeroProgress.level(fromLifetime: lifetimeEarned)
    }
}
