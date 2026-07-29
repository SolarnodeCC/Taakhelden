import Foundation
import Observation

@Observable
final class AppEnvironment {
    let authStore: AuthStore
    let apiClient: TaakHeldenAPIClient
    let parentAPIClient: APIClient
    let familyRoomClient: FamilyRoomClient
    let mutationQueue: MutationQueue
    let syncEngine: SyncEngine
    let celebrationService: CelebrationService
    let photoBonusService: PhotoBonusService
    let pushService: PushRegistrationService
    let parentGate: ParentGateCoordinator
    let localAuth: LocalAuthenticationClient
    let apiBaseURL: URL

    init(usePreviewData: Bool = false) {
        let keychain: KeychainStore = usePreviewData ? InMemoryKeychainStore() : SystemKeychainStore()
        let authStore = AuthStore(previewKeychain: keychain)
        let baseURL = URL(string: ProcessInfo.processInfo.environment["TAAKHELDEN_API_BASE_URL"] ?? "http://localhost:8787/v1")!
        let transport = TaakURLSessionTransport(baseURL: baseURL)
        let apiClient = TaakHeldenAPIClient(transport: transport, authStore: authStore)
        let mutationQueue = MutationQueue(store: usePreviewData ? InMemoryMutationQueueStore() : FileMutationQueueStore())
        let syncEngine = SyncEngine(apiClient: apiClient, mutationQueue: mutationQueue)

        self.authStore = authStore
        self.apiClient = apiClient
        self.apiBaseURL = baseURL
        self.parentAPIClient = usePreviewData
            ? PreviewAPIClient()
            : ParentAPIAdapter(api: apiClient, authStore: authStore)
        self.familyRoomClient = usePreviewData
            ? PreviewFamilyRoomClient()
            : LiveFamilyRoomClient(apiClient: apiClient, baseURL: baseURL)
        self.mutationQueue = mutationQueue
        self.syncEngine = syncEngine
        self.celebrationService = CelebrationService()
        self.photoBonusService = PhotoBonusService(apiClient: apiClient)
        self.pushService = PushRegistrationService(apiClient: apiClient)
        self.parentGate = ParentGateCoordinator()
        self.localAuth = usePreviewData ? PreviewLocalAuthenticationClient() : SystemLocalAuthenticationClient()
    }
}
