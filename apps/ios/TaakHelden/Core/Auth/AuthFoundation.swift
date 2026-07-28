import Foundation
import Observation

enum AppRestoreRoute {
    case welcome
    case parentOnboarding
    case childHome
}

enum ChildAgeBand: String, Codable, Equatable {
    case young
    case mid
    case teen

    var requiresVisiblePINAlternative: Bool {
        switch self {
        case .young, .mid:
            return true
        case .teen:
            return false
        }
    }
}

struct ParentSession: Codable, Equatable {
    let accessToken: String
    let refreshToken: String
    let familyID: String
    let userID: String
}

struct StoredChildSession: Codable, Equatable {
    let childID: String
    let displayName: String
    let avatar: String
    let ageBand: ChildAgeBand
    let accessToken: String
    let refreshToken: String
    let biometricsEnabled: Bool
}

enum KeychainKey: String {
    case parentSession
    case childSession
}

protocol KeychainStore {
    func loadValue(for key: KeychainKey) -> Data?
    func saveValue(_ value: Data, for key: KeychainKey)
}

final class InMemoryKeychainStore: KeychainStore {
    private var storage: [KeychainKey: Data] = [:]

    func loadValue(for key: KeychainKey) -> Data? {
        storage[key]
    }

    func saveValue(_ value: Data, for key: KeychainKey) {
        storage[key] = value
    }
}

protocol LocalAuthenticationClient {
    func canEvaluateBiometrics() -> Bool
}

struct PreviewLocalAuthenticationClient: LocalAuthenticationClient {
    func canEvaluateBiometrics() -> Bool { true }
}

@Observable
final class AuthStore {
    private let keychain: KeychainStore
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    var parentSession: ParentSession?
    var childSession: StoredChildSession?

    init(keychain: KeychainStore = InMemoryKeychainStore()) {
        self.keychain = keychain
        restoreSessions()
    }

    var restoredRoute: AppRestoreRoute {
        if childSession != nil {
            return .childHome
        }

        if parentSession != nil {
            return .parentOnboarding
        }

        return .welcome
    }

    func storeParentSession(_ session: ParentSession) {
        parentSession = session
        if let data = try? encoder.encode(session) {
            keychain.saveValue(data, for: .parentSession)
        }
    }

    func storeChildSession(_ session: ChildSession, biometricsEnabled: Bool = false) {
        let stored = StoredChildSession(
            childID: session.childID,
            displayName: session.displayName,
            avatar: session.avatar,
            ageBand: session.ageBand,
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            biometricsEnabled: biometricsEnabled
        )
        childSession = stored
        if let data = try? encoder.encode(stored) {
            keychain.saveValue(data, for: .childSession)
        }
    }

    private func restoreSessions() {
        if let parentData = keychain.loadValue(for: .parentSession),
           let restoredParent = try? decoder.decode(ParentSession.self, from: parentData) {
            parentSession = restoredParent
        }

        if let childData = keychain.loadValue(for: .childSession),
           let restoredChild = try? decoder.decode(StoredChildSession.self, from: childData) {
            childSession = restoredChild
        }
    }
}
