import Foundation
import Observation

@Observable
final class ParentOnboardingViewModel {
    enum Step: Equatable {
        case signIn
        case createChild
        case showFamilyCode
    }

    var step: Step = .signIn
    var familyName = ""
    var childName = ""
    var birthYear = "2018"
    var pin = ""
    var selectedAvatarEmoji = "🦊"
    var inviteCode: String?
    var createdChildName: String?
    var isLoading = false
    var errorMessage: String?

    private let apiClient: TaakHeldenAPIClient
    private let authStore: AuthStore

    let avatarEmojis = ["🦊", "🐼", "🦁", "🐙", "🦄", "🐯"]

    init(apiClient: TaakHeldenAPIClient, authStore: AuthStore) {
        self.apiClient = apiClient
        self.authStore = authStore
        if authStore.parentSession != nil {
            step = .createChild
        }
    }

    @MainActor
    func handleAppleSignIn(identityToken: String, familyName: String?, displayName: String?) async {
        isLoading = true
        defer { isLoading = false }

        do {
            let resolvedFamilyName = self.familyName.isEmpty ? (familyName ?? "Ons gezin") : self.familyName
            let resolvedDisplayName = displayName ?? "Ouder"
            let session = try await apiClient.signInWithApple(
                identityToken: identityToken,
                familyName: resolvedFamilyName,
                displayName: resolvedDisplayName
            )
            authStore.storeParentSession(session)
            if self.familyName.isEmpty {
                self.familyName = resolvedFamilyName
            }
            step = .createChild
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func createChildProfile() async -> Bool {
        guard pin.count == 4, let year = Int(birthYear), !childName.isEmpty else {
            errorMessage = "Vul alle velden in en kies een pincode van 4 cijfers."
            return false
        }

        isLoading = true
        defer { isLoading = false }

        do {
            let member = try await apiClient.createChild(
                displayName: childName,
                birthYear: year,
                avatarID: AvatarCatalog.id(forEmoji: selectedAvatarEmoji),
                pin: pin
            )
            createdChildName = member.displayName
            let family = try await apiClient.fetchParentFamily()
            inviteCode = family.inviteCode
            step = .showFamilyCode
            errorMessage = nil
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
}
