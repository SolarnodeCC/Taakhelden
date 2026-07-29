import AVFoundation
import Foundation
import SwiftUI

/// Young mode (4–7): near-textless chrome, large targets, TTS.
enum YoungModeSupport {
    static let minTapTarget: CGFloat = 64
    static let picturePINChoices = ["🦊", "🐼", "🦁", "🐸", "🦄", "🐙"]

    static func speak(_ text: String, language: String = "nl-NL") {
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: language)
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.9
        YoungSpeechBus.shared.speak(utterance)
    }

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

/// Speak button for young-mode surfaces.
struct YoungSpeakButton: View {
    let text: String
    let palette: THPalette

    var body: some View {
        Button {
            YoungModeSupport.speak(text)
        } label: {
            Image(systemName: "speaker.wave.2.fill")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(palette.onAccent.color)
                .frame(width: YoungModeSupport.minTapTarget, height: YoungModeSupport.minTapTarget)
                .background(palette.accent.color, in: Circle())
        }
        .accessibilityLabel(Text("child.young.speak"))
        .accessibilityHint(Text(text))
    }
}

struct YoungPrimaryButton: View {
    let titleKey: LocalizedStringKey
    let systemImage: String
    let palette: THPalette
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(titleKey, systemImage: systemImage)
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .frame(minWidth: YoungModeSupport.minTapTarget, minHeight: YoungModeSupport.minTapTarget)
                .padding(.horizontal, THSpacing.lg)
        }
        .buttonStyle(.borderedProminent)
        .tint(palette.accent.color)
    }
}
