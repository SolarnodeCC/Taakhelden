import AVFoundation
import Foundation

final class SoundEffectService {
    private var player: AVAudioPlayer?

    func playTaskCompleteChime() {
        guard let url = Bundle.main.url(forResource: "task-complete", withExtension: "wav") else {
            playSystemFallback()
            return
        }

        do {
            try AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])
            try AVAudioSession.sharedInstance().setActive(true)
            player = try AVAudioPlayer(contentsOf: url)
            player?.volume = 0.35
            player?.play()
        } catch {
            playSystemFallback()
        }
    }

    private func playSystemFallback() {
        AudioServicesPlaySystemSound(1057) // short positive system tone
    }
}

import AudioToolbox

enum AppSettings {
    private static let soundsKey = "taakhelden.childSoundsEnabled"

    static var childSoundsEnabled: Bool {
        get {
            if UserDefaults.standard.object(forKey: soundsKey) == nil {
                return true
            }
            return UserDefaults.standard.bool(forKey: soundsKey)
        }
        set {
            UserDefaults.standard.set(newValue, forKey: soundsKey)
        }
    }
}
