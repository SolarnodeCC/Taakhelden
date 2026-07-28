import Foundation
import UIKit

@Observable
final class CelebrationService {
    func celebrateTaskCompleted(reduceMotion: Bool) {
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)

        guard !reduceMotion else { return }
        // Visual confetti is rendered in SwiftUI; haptic always fires when enabled.
    }
}
