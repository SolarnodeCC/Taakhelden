import SwiftUI

/// Wispel mark v1 — soft Ster + trailing wisp. Mirrors `apps/web/public/brand/mark.svg`.
struct WispelMark: View {
    var size: CGFloat = 28

    var body: some View {
        ZStack {
            WispelStarShape()
            WispelWispShape()
                .stroke(style: StrokeStyle(lineWidth: max(1.5, size * 0.057), lineCap: .round))
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// Mark + “Wispel” word. Color via `.foregroundStyle`.
struct WispelWordmark: View {
    var markSize: CGFloat = 28
    var font: Font = .title3.weight(.semibold)

    var body: some View {
        HStack(spacing: 8) {
            WispelMark(size: markSize)
            Text("Wispel")
                .font(font)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Wispel")
    }
}

private struct WispelStarShape: Shape {
    func path(in rect: CGRect) -> Path {
        let scale = min(rect.width, rect.height) / 48
        let o = rect.origin
        let cx: CGFloat = 24
        let cy: CGFloat = 22
        let outer: CGFloat = 17
        let inner: CGFloat = 7.2
        let spikes = 5
        var angle = -CGFloat.pi / 2
        let step = CGFloat.pi / CGFloat(spikes)
        var path = Path()
        for i in 0..<(spikes * 2) {
            let r = i.isMultiple(of: 2) ? outer : inner
            let p = CGPoint(
                x: o.x + (cx + cos(angle) * r) * scale,
                y: o.y + (cy + sin(angle) * r) * scale
            )
            if i == 0 {
                path.move(to: p)
            } else {
                path.addLine(to: p)
            }
            angle += step
        }
        path.closeSubpath()
        return path
    }
}

private struct WispelWispShape: Shape {
    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height) / 48
        let o = rect.origin
        var path = Path()
        path.move(to: CGPoint(x: o.x + 36.5 * s, y: o.y + 34.5 * s))
        path.addQuadCurve(
            to: CGPoint(x: o.x + 42.7 * s, y: o.y + 43.5 * s),
            control: CGPoint(x: o.x + 40 * s, y: o.y + 38 * s)
        )
        return path
    }
}

#Preview {
    let accent = Color(red: 14 / 255, green: 159 / 255, blue: 142 / 255)
    return VStack(spacing: 24) {
        WispelMark(size: 48)
        WispelWordmark()
    }
    .foregroundStyle(accent)
    .padding()
}
