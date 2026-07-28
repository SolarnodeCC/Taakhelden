import SwiftUI

enum THSpacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
    static let xxl: CGFloat = 32
}

enum THRadius {
    static let medium: CGFloat = 10
    static let large: CGFloat = 16
    static let xlarge: CGFloat = 24
    static let pill: CGFloat = 999
}

struct THColorToken: Equatable {
    let hex: UInt64
    let alpha: Double

    init(hex: UInt64, alpha: Double = 1) {
        self.hex = hex
        self.alpha = alpha
    }

    var color: Color {
        Color(hex: hex, alpha: alpha)
    }
}

struct THPalette {
    let background: THColorToken
    let surface: THColorToken
    let text: THColorToken
    let mutedText: THColorToken
    let accent: THColorToken
    let accentSoft: THColorToken
    /// Companion accent (kid turquoise / teen mint soft companion).
    let secondary: THColorToken
    let highlight: THColorToken
    let shadow: THColorToken
}

enum THPalettes {
    // Mirrors apps/web/app/globals.css — kid/teen remain brand-placeholders.
    static let kid = THPalette(
        background: THColorToken(hex: 0xFFF8EC), // --kid-cream
        surface: THColorToken(hex: 0xFFFFFF),
        text: THColorToken(hex: 0x2B2116), // --kid-text
        mutedText: THColorToken(hex: 0x6B5D4C),
        accent: THColorToken(hex: 0xFF6F59), // --kid-coral
        accentSoft: THColorToken(hex: 0xFFE1DA), // --kid-coral-soft
        secondary: THColorToken(hex: 0x0E9F8E), // --kid-turquoise
        highlight: THColorToken(hex: 0xFFC93C), // --kid-yellow
        shadow: THColorToken(hex: 0xFF6F59, alpha: 0.28) // --shadow-kid
    )

    static let teen = THPalette(
        background: THColorToken(hex: 0x1F2A44), // --teen-navy
        surface: THColorToken(hex: 0x26314D), // --teen-navy-surface
        text: THColorToken(hex: 0xE9EDF5), // --teen-text
        mutedText: THColorToken(hex: 0x9AA6C3), // --teen-muted
        accent: THColorToken(hex: 0x7FD8C4), // --teen-mint
        accentSoft: THColorToken(hex: 0x364260),
        secondary: THColorToken(hex: 0x7FD8C4),
        highlight: THColorToken(hex: 0x7FD8C4),
        shadow: THColorToken(hex: 0x1F2A44, alpha: 0.35)
    )

    static let parent = THPalette(
        background: THColorToken(hex: 0xFFFFFF),
        surface: THColorToken(hex: 0xF6F7F9),
        text: THColorToken(hex: 0x1B1F24),
        mutedText: THColorToken(hex: 0x5A6470),
        accent: THColorToken(hex: 0x0E9F8E),
        accentSoft: THColorToken(hex: 0xD9F2EF),
        secondary: THColorToken(hex: 0x0E9F8E),
        highlight: THColorToken(hex: 0x0E9F8E),
        shadow: THColorToken(hex: 0x000000, alpha: 0.08)
    )
}

struct THCard<Content: View>: View {
    let palette: THPalette
    var cornerRadius: CGFloat = THRadius.xlarge
    var shadowRadius: CGFloat = 14
    var shadowYOffset: CGFloat = 6
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: THSpacing.md) {
            content
        }
        .padding(THSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(palette.surface.color)
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        .shadow(color: palette.shadow.color, radius: shadowRadius, y: shadowYOffset)
    }
}

struct THBadge: View {
    let text: LocalizedStringKey
    let palette: THPalette
    var fontDesign: Font.Design = .rounded

    var body: some View {
        Text(text)
            .font(.system(size: 14, weight: .semibold, design: fontDesign))
            .foregroundStyle(palette.text.color)
            .padding(.horizontal, THSpacing.md)
            .padding(.vertical, THSpacing.sm)
            .background(palette.accentSoft.color)
            .clipShape(Capsule())
    }
}

extension Color {
    init(hex: UInt64, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}
