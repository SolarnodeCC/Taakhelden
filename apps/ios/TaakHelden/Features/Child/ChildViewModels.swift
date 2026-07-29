import Foundation
import Observation

enum ChildDayLoadState: Equatable {
    case loading
    case ready(ChildTodayViewDTO)
    case emptyAllDone(TodayBalanceDTO)
    case emptyNoTasks
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
        state = .loading
        do {
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
        celebrationService.celebrateTaskCompleted(reduceMotion: reduceMotion)

        _ = await syncEngine.syncNow()
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

    var rewards: ChildRewardsViewDTO?
    var redemptions: [RedemptionViewDTO] = []
    var isLoading = false
    var errorMessage: String?

    init(apiClient: TaakHeldenAPIClient) {
        self.apiClient = apiClient
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
