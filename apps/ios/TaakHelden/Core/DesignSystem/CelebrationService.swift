import Foundation
import UIKit

@Observable
final class CelebrationService {
    private let sound = SoundEffectService()
    private(set) var confettiToken = 0

    func celebrateTaskCompleted(reduceMotion: Bool) {
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)

        if AppSettings.childSoundsEnabled {
            sound.playTaskCompleteChime()
        }

        _ = reduceMotion
        confettiToken += 1
    }
}
