import Foundation

protocol PushTokenProviding {
    var apnsToken: String? { get }
}

@Observable
final class PushRegistrationService {
    private let apiClient: TaakHeldenAPIClient
    private(set) var isRegistered = false

    init(apiClient: TaakHeldenAPIClient) {
        self.apiClient = apiClient
    }

    func registerIfNeeded(tokenProvider: PushTokenProviding) async {
        guard let token = tokenProvider.apnsToken, !isRegistered else { return }
        do {
            try await apiClient.registerDevice(apnsToken: token)
            isRegistered = true
        } catch {
            // Push is optional — app must keep working without it.
        }
    }
}
