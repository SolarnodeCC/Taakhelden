import Foundation
import Observation

enum ParentGateEntryPoint: Equatable {
    case heroWordmarkLongPress
    case buildNumberFiveTap
}

enum ParentGateUnlockMethod: Equatable {
    case localAuthentication
    case parentAccount
}

struct ParentGatePolicy {
    static let childTabCount = 3
    static let idleTimeoutMinutes = 10
    static let hiddenEntryPoints: [ParentGateEntryPoint] = [
        .heroWordmarkLongPress,
        .buildNumberFiveTap,
    ]

    static func childUnlockMode(for ageBand: ChildAgeBand, biometricsEnabled: Bool) -> ChildUnlockMode {
        if ageBand.requiresVisiblePINAlternative {
            return .biometricsWithVisiblePIN
        }

        return biometricsEnabled ? .biometricsWithOptionalPIN : .pinOnly
    }
}

enum ChildUnlockMode: Equatable {
    case pinOnly
    case biometricsWithVisiblePIN
    case biometricsWithOptionalPIN
}

@Observable
final class ParentGateCoordinator {
    var isChallengePresented = false
    var isParentModePresented = false
    var activeEntryPoint: ParentGateEntryPoint?
    var lastUnlockMethod: ParentGateUnlockMethod?
    var lastUnlockedAt: Date?

    func openGate() {
        isChallengePresented = true
    }

    func openGate(from entryPoint: ParentGateEntryPoint) {
        activeEntryPoint = entryPoint
        isChallengePresented = true
    }

    func unlock(using method: ParentGateUnlockMethod, now: Date = .now) {
        lastUnlockMethod = method
        lastUnlockedAt = now
        isChallengePresented = false
        isParentModePresented = true
    }

    func closeGate() {
        isChallengePresented = false
        activeEntryPoint = nil
    }

    func closeParentMode() {
        isParentModePresented = false
        closeGate()
    }

    func parentSessionRequiresReauth(now: Date = .now) -> Bool {
        guard let lastUnlockedAt else {
            return true
        }

        let elapsedMinutes = now.timeIntervalSince(lastUnlockedAt) / 60
        return elapsedMinutes >= Double(ParentGatePolicy.idleTimeoutMinutes)
    }
}
