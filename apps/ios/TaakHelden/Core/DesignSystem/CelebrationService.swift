import Foundation
import UIKit

@Observable
final class CelebrationService {
    private let sound = SoundEffectService()
    private(set) var confettiToken = 0

    func celebrateTaskCompleted(reduceMotion: Bool) {
        // Haptic and sound celebrate the completion regardless of motion preference.
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)

        if AppSettings.childSoundsEnabled {
            sound.playTaskCompleteChime()
        }

        // Only trigger confetti / motion overlay when Reduce Motion is off.
        // ConfettiOverlay already shows a static glow when reduceMotion is true,
        // but we must not increment the token at all so no animation fires.
        if !reduceMotion {
            confettiToken += 1
        }
    }
}
