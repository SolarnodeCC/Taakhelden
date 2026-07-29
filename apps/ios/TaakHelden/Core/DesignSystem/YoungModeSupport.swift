import AVFoundation
import Foundation

/// Foundations for `ageMode: young` (4–7): picture-PIN selection + optional TTS.
/// Full near-textless shell lands after design pass; this keeps the contract hooks ready.
enum YoungModeSupport {
    static let picturePINChoices = ["🦊", "🐼", "🦁", "🐸", "🦄", "🐙"]

    static func speak(_ text: String, language: String = "nl-NL") {
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: language)
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.9
        YoungSpeechBus.shared.speak(utterance)
    }

    /// Validates a 3-emoji picture sequence against a stored sequence string.
    static func matchesPicturePIN(selection: [String], stored: [String]) -> Bool {
        guard selection.count == stored.count, !stored.isEmpty else { return false }
        return selection == stored
    }
}

private final class YoungSpeechBus {
    static let shared = YoungSpeechBus()
    private let synthesizer = AVSpeechSynthesizer()

    func speak(_ utterance: AVSpeechUtterance) {
        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .immediate)
        }
        synthesizer.speak(utterance)
    }
}

struct PicturePINChallenge: Equatable {
    let options: [String]
    let target: [String]

    static func preview() -> PicturePINChallenge {
        PicturePINChallenge(
            options: YoungModeSupport.picturePINChoices,
            target: Array(YoungModeSupport.picturePINChoices.prefix(3))
        )
    }
}
