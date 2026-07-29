import Foundation
import Observation

enum ParentSyncTrigger: String, Equatable {
    case appBecameActive
    case manualRefresh
    case approvalResolved
    case backgroundPush
    case websocketReconnect
    case settingsChanged
}

enum ParentSyncState: Equatable {
    case idle
    case syncing(trigger: ParentSyncTrigger)
    case synced(trigger: ParentSyncTrigger, at: Date)
    case failed(trigger: ParentSyncTrigger, message: String)
}

@Observable
final class ParentSyncCoordinator {
    var state: ParentSyncState = .idle
    var lastTrigger: ParentSyncTrigger?

    func begin(_ trigger: ParentSyncTrigger) {
        lastTrigger = trigger
        state = .syncing(trigger: trigger)
    }

    func finish(_ trigger: ParentSyncTrigger, at date: Date = .now) {
        lastTrigger = trigger
        state = .synced(trigger: trigger, at: date)
    }

    func fail(_ trigger: ParentSyncTrigger, message: String) {
        lastTrigger = trigger
        state = .failed(trigger: trigger, message: message)
    }
}
