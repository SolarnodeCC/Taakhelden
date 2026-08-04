import Foundation
import Observation

/// Phase of a focus/homework timer session.
enum FocusTimerPhase: Equatable {
    case idle
    case running
    case paused
    case completed
}

/// Lightweight client-side homework focus timer.
///
/// - No points are awarded for elapsed time (WS-FOCUS invariant).
/// - No server session is logged in v1.
/// - Works fully offline; state lives in-process only.
@Observable
@MainActor
final class FocusTimerService {
    private(set) var phase: FocusTimerPhase = .idle
    private(set) var elapsed: TimeInterval = 0
    private(set) var targetDuration: TimeInterval = 25 * 60

    private var timer: Timer?
    private var startedAt: Date?
    private var accumulatedBeforePause: TimeInterval = 0

    var progress: Double {
        guard targetDuration > 0 else { return 0 }
        return min(1.0, elapsed / targetDuration)
    }

    var remainingSeconds: Int {
        max(0, Int(targetDuration - elapsed))
    }

    var formattedRemaining: String {
        let mins = remainingSeconds / 60
        let secs = remainingSeconds % 60
        return String(format: "%d:%02d", mins, secs)
    }

    var formattedElapsed: String {
        let total = Int(elapsed)
        let mins = total / 60
        let secs = total % 60
        return String(format: "%d:%02d", mins, secs)
    }

    func start(duration: TimeInterval = 25 * 60) {
        guard phase == .idle || phase == .paused else { return }
        if phase == .idle {
            targetDuration = duration
            accumulatedBeforePause = 0
            elapsed = 0
        }
        phase = .running
        startedAt = Date()
        scheduleTimer()
    }

    func pause() {
        guard phase == .running else { return }
        accumulatedBeforePause = elapsed
        phase = .paused
        invalidateTimer()
    }

    func stop() {
        invalidateTimer()
        phase = .idle
        elapsed = 0
        accumulatedBeforePause = 0
        startedAt = nil
    }

    private func scheduleTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in self?.tick() }
        }
    }

    private func tick() {
        guard let startedAt, phase == .running else { return }
        let now = accumulatedBeforePause + Date().timeIntervalSince(startedAt)
        elapsed = min(now, targetDuration)
        if elapsed >= targetDuration {
            invalidateTimer()
            phase = .completed
        }
    }

    private func invalidateTimer() {
        timer?.invalidate()
        timer = nil
        startedAt = nil
    }
}
