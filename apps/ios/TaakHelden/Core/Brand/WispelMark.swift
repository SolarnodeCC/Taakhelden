import SwiftUI

/// Wispel mark v1 — soft Ster + trailing wisp.
/// Path geometry matches `apps/web/public/brand/mark.svg` (viewBox 0 0 48 48).
struct WispelMark: View {
    var size: CGFloat = 28

    var body: some View {
        ZStack {
            WispelStarShape()
            WispelWispShape()
                .stroke(style: StrokeStyle(lineWidth: max(1.5, size * (2.75 / 48)), lineCap: .round))
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

/// Soft star from mark.svg path `d` (cubic segments preserved).
private struct WispelStarShape: Shape {
    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height) / 48
        let o = rect.origin
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: o.x + x * s, y: o.y + y * s)
        }

        var path = Path()
        path.move(to: p(24, 5))
        path.addCurve(to: p(25.62, 6.1), control1: p(24.72, 5), control2: p(25.36, 5.42))
        path.addLine(to: p(29.17, 15.15))
        path.addLine(to: p(38.82, 15.65))
        path.addCurve(to: p(39.8, 18.55), control1: p(40.32, 15.73), control2: p(40.94, 17.63))
        path.addLine(to: p(32.45, 24.5))
        path.addLine(to: p(34.95, 33.9))
        path.addCurve(to: p(32.5, 35.7), control1: p(35.32, 35.32), control2: p(33.75, 36.45))
        path.addLine(to: p(24, 30.35))
        path.addLine(to: p(15.5, 35.7))
        path.addCurve(to: p(13.05, 33.9), control1: p(14.25, 36.45), control2: p(12.68, 35.32))
        path.addLine(to: p(15.55, 24.5))
        path.addLine(to: p(8.2, 18.55))
        path.addCurve(to: p(9.18, 15.65), control1: p(7.06, 17.63), control2: p(7.68, 15.73))
        path.addLine(to: p(18.83, 15.15))
        path.addLine(to: p(22.38, 6.1))
        path.addCurve(to: p(24, 5), control1: p(22.64, 5.42), control2: p(23.28, 5))
        path.closeSubpath()
        return path
    }
}

/// Trailing wisp stroke from mark.svg.
private struct WispelWispShape: Shape {
    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height) / 48
        let o = rect.origin
        var path = Path()
        path.move(to: CGPoint(x: o.x + 36.5 * s, y: o.y + 34.5 * s))
        path.addCurve(
            to: CGPoint(x: o.x + 42.7 * s, y: o.y + 43.5 * s),
            control1: CGPoint(x: o.x + 39.7 * s, y: o.y + 36.3 * s),
            control2: CGPoint(x: o.x + 42.1 * s, y: o.y + 39.6 * s)
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
