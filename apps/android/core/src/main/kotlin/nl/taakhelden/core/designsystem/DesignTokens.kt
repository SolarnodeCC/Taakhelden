package nl.taakhelden.core.designsystem

/**
 * Design tokens shared by every Wispel surface on Android.
 *
 * Colours are stored as plain ARGB longs so the token set lives in the platform-free core
 * module and can be unit-tested (contrast checks) without pulling in Compose. The Compose
 * theme in `:app` maps these onto `Color`.
 *
 * Values mirror `apps/web/app/globals.css` and the iOS `THPalettes` — Wispel brand v1.
 * See `docs/brand/wispel-brand-v1.md`. Never hard-code a hex outside this file.
 */
public object WSpacing {
    public const val XS: Int = 4
    public const val SM: Int = 8
    public const val MD: Int = 12
    public const val LG: Int = 16
    public const val XL: Int = 24
    public const val XXL: Int = 32
}

public object WRadius {
    public const val MEDIUM: Int = 10
    public const val LARGE: Int = 16
    public const val XLARGE: Int = 24
    public const val PILL: Int = 999
}

/** An sRGB colour token: 24-bit [hex] plus an [alpha] in 0.0–1.0. */
public data class WColorToken(
    val hex: Long,
    val alpha: Float = 1f,
) {
    /** Packed 0xAARRGGBB, ready for `Color(argb)` in Compose. */
    public val argb: Long
        get() = ((alpha.coerceIn(0f, 1f) * 255f).toLong() shl 24) or (hex and 0xFFFFFF)

    public val red: Int get() = ((hex shr 16) and 0xFF).toInt()
    public val green: Int get() = ((hex shr 8) and 0xFF).toInt()
    public val blue: Int get() = (hex and 0xFF).toInt()
}

public data class WPalette(
    val background: WColorToken,
    val surface: WColorToken,
    val text: WColorToken,
    val mutedText: WColorToken,
    val accent: WColorToken,
    val accentSoft: WColorToken,
    /** Text/icon colour on solid accent fills (Speak button, etc.). */
    val onAccent: WColorToken,
    /** Companion accent (kid turquoise / teen mint soft companion). */
    val secondary: WColorToken,
    val highlight: WColorToken,
    val shadow: WColorToken,
)

public object WPalettes {
    /** Warm/round kid register — coral, turquoise and yellow on cream. */
    public val kid: WPalette = WPalette(
        background = WColorToken(0xFFF8EC), // --kid-cream
        surface = WColorToken(0xFFFFFF),
        text = WColorToken(0x2B2116), // --kid-text
        mutedText = WColorToken(0x6B5D4C),
        accent = WColorToken(0xFF6F59), // --kid-coral
        accentSoft = WColorToken(0xFFE1DA), // --kid-coral-soft
        // White on coral is ~2.74:1 (fails the WCAG 3:1 UI-component rule); use kid-text.
        onAccent = WColorToken(0x2B2116),
        secondary = WColorToken(0x0E9F8E), // --kid-turquoise
        highlight = WColorToken(0xFFC93C), // --kid-yellow
        shadow = WColorToken(0xFF6F59, alpha = 0.28f), // --shadow-kid
    )

    /** Muted teen register — mint on navy. */
    public val teen: WPalette = WPalette(
        background = WColorToken(0x1F2A44), // --teen-navy
        surface = WColorToken(0x26314D), // --teen-navy-surface
        text = WColorToken(0xE9EDF5), // --teen-text
        mutedText = WColorToken(0x9AA6C3), // --teen-muted
        accent = WColorToken(0x7FD8C4), // --teen-mint
        accentSoft = WColorToken(0x364260),
        onAccent = WColorToken(0x1F2A44),
        secondary = WColorToken(0x7FD8C4),
        highlight = WColorToken(0x7FD8C4),
        shadow = WColorToken(0x1F2A44, alpha = 0.35f),
    )

    /** Calm/neutral parent-dashboard register — one teal accent on white. */
    public val parent: WPalette = WPalette(
        background = WColorToken(0xFFFFFF),
        surface = WColorToken(0xF6F7F9),
        text = WColorToken(0x1B1F24),
        mutedText = WColorToken(0x5A6470),
        accent = WColorToken(0x0E9F8E),
        accentSoft = WColorToken(0xD9F2EF),
        onAccent = WColorToken(0xFFFFFF),
        secondary = WColorToken(0x0E9F8E),
        highlight = WColorToken(0x0E9F8E),
        shadow = WColorToken(0x000000, alpha = 0.08f),
    )
}

/** Shared level curve — mirrors `levelFromLifetime` in apps/api/src/repo/avatar.ts. */
public object HeroProgress {
    public fun levelFromLifetime(lifetimeEarned: Int): Int = maxOf(1, lifetimeEarned / 100)

    public fun goalFraction(earned: Int, target: Int): Double {
        if (target <= 0) return 0.0
        return minOf(1.0, earned.toDouble() / target.toDouble())
    }
}

/** Young mode (4–7): near-textless chrome, large targets, TTS. */
public object YoungMode {
    /** Minimum tap target in dp — well above the 48dp Material floor. */
    public const val MIN_TAP_TARGET_DP: Int = 64

    public val picturePinChoices: List<String> =
        listOf("🦊", "🐼", "🦁", "🐸", "🦄", "🐙")

    public fun matchesPicturePin(selection: List<String>, stored: List<String>): Boolean {
        if (stored.isEmpty() || selection.size != stored.size) return false
        return selection == stored
    }
}

/** Relative luminance + contrast helpers, used by the palette a11y unit tests. */
public object ContrastMath {
    public fun relativeLuminance(token: WColorToken): Double {
        fun channel(value: Int): Double {
            val srgb = value / 255.0
            return if (srgb <= 0.03928) srgb / 12.92 else Math.pow((srgb + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * channel(token.red) +
            0.7152 * channel(token.green) +
            0.0722 * channel(token.blue)
    }

    public fun contrastRatio(a: WColorToken, b: WColorToken): Double {
        val la = relativeLuminance(a)
        val lb = relativeLuminance(b)
        val lighter = maxOf(la, lb)
        val darker = minOf(la, lb)
        return (lighter + 0.05) / (darker + 0.05)
    }
}
