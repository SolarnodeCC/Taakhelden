import Foundation
import Observation

enum ParentGateEntryPoint: Equatable {
    case heroWordmarkLongPress
    case buildNumberFiveTap
}

struct ParentGatePolicy {
    static let childTabCount = 3
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
    var isParentSheetPresented = false

    func openGate() {
        isParentSheetPresented = true
    }

    func closeGate() {
        isParentSheetPresented = false
    }
}
