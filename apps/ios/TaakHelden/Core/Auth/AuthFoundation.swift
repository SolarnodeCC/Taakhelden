import Foundation
import Observation

enum AppRestoreRoute {
    case welcome
    case parentOnboarding
    case childUnlock
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
    var accessToken: String
    var refreshToken: String
    let familyID: String
    let userID: String
}

struct StoredChildSession: Codable, Equatable {
    let childID: String
    let displayName: String
    let avatar: String
    let ageBand: ChildAgeBand
    var accessToken: String
    var refreshToken: String
    var biometricsEnabled: Bool
}

enum KeychainKey: String {
    case parentSession
    case childSession
    case childPIN
}

protocol KeychainStore {
    func loadValue(for key: KeychainKey) -> Data?
    func saveValue(_ value: Data, for key: KeychainKey)
    func deleteValue(for key: KeychainKey)
}

extension KeychainStore {
    func deleteValue(for key: KeychainKey) {}
}

final class InMemoryKeychainStore: KeychainStore {
    private var storage: [KeychainKey: Data] = [:]

    func loadValue(for key: KeychainKey) -> Data? {
        storage[key]
    }

    func saveValue(_ value: Data, for key: KeychainKey) {
        storage[key] = value
    }

    func deleteValue(for key: KeychainKey) {
        storage[key] = nil
    }
}

@Observable
final class AuthStore {
    private let keychain: KeychainStore
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    var parentSession: ParentSession?
    var childSession: StoredChildSession?
    var isChildUnlocked = false

    init(keychain: KeychainStore = SystemKeychainStore()) {
        self.keychain = keychain
        restoreSessions()
    }

    init(previewKeychain: KeychainStore) {
        self.keychain = previewKeychain
        restoreSessions()
    }

    var restoredRoute: AppRestoreRoute {
        if childSession != nil {
            return isChildUnlocked ? .childHome : .childUnlock
        }

        if parentSession != nil {
            return .parentOnboarding
        }

        return .welcome
    }

    func storeParentSession(_ session: ParentSession) {
        parentSession = session
        persistParent()
    }

    func updateParentTokens(accessToken: String, refreshToken: String) {
        guard var session = parentSession else { return }
        session.accessToken = accessToken
        session.refreshToken = refreshToken
        parentSession = session
        persistParent()
    }

    func storeChildSession(_ session: ChildSession, biometricsEnabled: Bool = false, pin: String) {
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
        isChildUnlocked = true
        if let data = try? encoder.encode(stored) {
            keychain.saveValue(data, for: .childSession)
        }
        if let pinData = pin.data(using: .utf8) {
            keychain.saveValue(pinData, for: .childPIN)
        }
    }

    func updateChildTokens(accessToken: String, refreshToken: String) {
        guard var session = childSession else { return }
        session.accessToken = accessToken
        session.refreshToken = refreshToken
        childSession = session
        if let data = try? encoder.encode(session) {
            keychain.saveValue(data, for: .childSession)
        }
    }

    func verifyPIN(_ pin: String) -> Bool {
        guard let stored = keychain.loadValue(for: .childPIN),
              let storedPIN = String(data: stored, encoding: .utf8) else {
            return false
        }
        return storedPIN == pin
    }

    func lockChildSession() {
        isChildUnlocked = false
    }

    func unlockChildSession() {
        isChildUnlocked = true
    }

    func clearChildSession() {
        childSession = nil
        isChildUnlocked = false
        keychain.deleteValue(for: .childSession)
        keychain.deleteValue(for: .childPIN)
    }

    func clearParentSession() {
        parentSession = nil
        keychain.deleteValue(for: .parentSession)
    }

    func clearAllSessions() {
        clearChildSession()
        clearParentSession()
    }

    private func persistParent() {
        if let session = parentSession, let data = try? encoder.encode(session) {
            keychain.saveValue(data, for: .parentSession)
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
            isChildUnlocked = false
        }
    }
}
