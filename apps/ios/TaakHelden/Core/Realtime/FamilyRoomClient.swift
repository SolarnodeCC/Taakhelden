import Foundation

enum FamilyRoomConnectionState: Equatable {
    case disconnected
    case connecting
    case connected
    case waitingToReconnect(seconds: Int)
}

enum FamilyRoomEvent: Equatable {
    case approvalsChanged
    case todayChanged
    case settingsChanged
}

struct FamilyRoomReconnectPolicy: Equatable {
    let delaysInSeconds: [Int]

    static let parentDefault = FamilyRoomReconnectPolicy(delaysInSeconds: [2, 4, 8])

    func delay(forAttempt attempt: Int) -> Int {
        guard let firstDelay = delaysInSeconds.first else {
            return 0
        }

        guard attempt > 0 else {
            return firstDelay
        }

        let index = min(attempt, delaysInSeconds.count - 1)
        return delaysInSeconds[index]
    }
}

protocol FamilyRoomClient: AnyObject {
    func connect(
        onStatusChange: @escaping @Sendable (FamilyRoomConnectionState) -> Void,
        onEvent: @escaping @Sendable (FamilyRoomEvent) -> Void
    )
    func disconnect()
}

final class PreviewFamilyRoomClient: FamilyRoomClient {
    private var onStatusChange: ((FamilyRoomConnectionState) -> Void)?
    private var onEvent: ((FamilyRoomEvent) -> Void)?

    func connect(
        onStatusChange: @escaping @Sendable (FamilyRoomConnectionState) -> Void,
        onEvent: @escaping @Sendable (FamilyRoomEvent) -> Void
    ) {
        self.onStatusChange = onStatusChange
        self.onEvent = onEvent

        onStatusChange(.connecting)
        onStatusChange(.connected)
    }

    func disconnect() {
        onStatusChange?(.disconnected)
        onStatusChange = nil
        onEvent = nil
    }

    func simulateEvent(_ event: FamilyRoomEvent) {
        onEvent?(event)
    }

    func simulateReconnect(attempt: Int, policy: FamilyRoomReconnectPolicy = .parentDefault) {
        onStatusChange?(.waitingToReconnect(seconds: policy.delay(forAttempt: attempt)))
    }
}
