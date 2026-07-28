import SwiftUI

struct ConfettiPiece: Identifiable {
    let id = UUID()
    let x: CGFloat
    let color: Color
    let delay: Double
}

struct ConfettiOverlay: View {
    let token: Int
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        if !reduceMotion {
            ConfettiBurstView(token: token)
                .allowsHitTesting(false)
        } else {
            ReduceMotionGlow(token: token)
                .allowsHitTesting(false)
        }
    }
}

private struct ConfettiBurstView: View {
    let token: Int
    @State private var pieces: [ConfettiPiece] = []

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                ForEach(pieces) { piece in
                    RoundedRectangle(cornerRadius: 2)
                        .fill(piece.color)
                        .frame(width: 8, height: 12)
                        .position(x: piece.x * proxy.size.width, y: proxy.size.height * 0.2)
                        .modifier(ConfettiFallModifier(delay: piece.delay))
                }
            }
        }
        .onChange(of: token) { _, _ in
            spawnPieces()
        }
        .onAppear { spawnPieces() }
    }

    private func spawnPieces() {
        let colors: [Color] = [
            THPalettes.kid.accent.color,
            THPalettes.kid.highlight.color,
            THPalettes.kid.accentSoft.color,
        ]
        pieces = (0..<24).map { index in
            ConfettiPiece(
                x: CGFloat.random(in: 0.1...0.9),
                color: colors[index % colors.count],
                delay: Double(index) * 0.02
            )
        }
    }
}

private struct ConfettiFallModifier: ViewModifier {
    let delay: Double
    @State private var offset: CGFloat = -40
    @State private var opacity: Double = 1

    func body(content: Content) -> some View {
        content
            .offset(y: offset)
            .opacity(opacity)
            .onAppear {
                withAnimation(.easeOut(duration: 1.1).delay(delay)) {
                    offset = 220
                    opacity = 0
                }
            }
    }
}

private struct ReduceMotionGlow: View {
    let token: Int
    @State private var scale: CGFloat = 0.9

    var body: some View {
        Circle()
            .fill(THPalettes.kid.accent.color.opacity(0.25))
            .frame(width: 120, height: 120)
            .scaleEffect(scale)
            .onChange(of: token) { _, _ in pulse() }
            .onAppear { pulse() }
    }

    private func pulse() {
        scale = 0.9
        withAnimation(.easeOut(duration: 0.45)) {
            scale = 1.15
        }
    }
}
