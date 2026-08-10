package nl.taakhelden.family.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ProvidableCompositionLocal
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import nl.taakhelden.core.designsystem.WColorToken
import nl.taakhelden.core.designsystem.WPalette
import nl.taakhelden.core.designsystem.WPalettes
import nl.taakhelden.core.designsystem.WRadius
import nl.taakhelden.core.designsystem.WSpacing

/**
 * Bridges a shared design token onto a Compose colour.
 *
 * This is the only place a colour is constructed from a number. Everything else reads
 * `WispelTheme.palette`, so the palettes stay the single source of truth.
 */
val WColorToken.color: Color get() = Color(argb)

/**
 * Which of the three registers the current subtree is painted in.
 *
 * Wispel deliberately runs two visual languages over one token set: the parent dashboard
 * is calm and neutral, the child app is warm and round, and teen mode is muted. Choosing
 * the register is an explicit decision at the screen level, not something a component
 * guesses.
 */
enum class WRegister { PARENT, KID, TEEN }

val LocalWPalette: ProvidableCompositionLocal<WPalette> =
    staticCompositionLocalOf { WPalettes.parent }
val LocalWRegister: ProvidableCompositionLocal<WRegister> =
    staticCompositionLocalOf { WRegister.PARENT }

/**
 * True when the child profile is in young mode (4–7): bigger targets, bigger type, and a
 * read-aloud button next to the text.
 */
val LocalYoungMode: ProvidableCompositionLocal<Boolean> = staticCompositionLocalOf { false }

object WispelTheme {
    val palette: WPalette
        @Composable get() = LocalWPalette.current

    val register: WRegister
        @Composable get() = LocalWRegister.current

    val isYoung: Boolean
        @Composable get() = LocalYoungMode.current
}

object WDimens {
    val spacingXs = WSpacing.XS.dp
    val spacingSm = WSpacing.SM.dp
    val spacingMd = WSpacing.MD.dp
    val spacingLg = WSpacing.LG.dp
    val spacingXl = WSpacing.XL.dp
    val spacingXxl = WSpacing.XXL.dp

    val radiusMedium = WRadius.MEDIUM.dp
    val radiusLarge = WRadius.LARGE.dp
    val radiusXLarge = WRadius.XLARGE.dp

    /** Material's minimum touch target; young mode raises it (see `YoungMode`). */
    val minTapTarget = 48.dp
}

private val WispelTypography = Typography(
    displaySmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 30.sp,
        lineHeight = 36.sp,
    ),
    headlineSmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 22.sp,
        lineHeight = 28.sp,
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 17.sp,
        lineHeight = 24.sp,
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 24.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp,
    ),
    labelMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 13.sp,
        lineHeight = 18.sp,
    ),
)

@Composable
fun WispelTheme(
    register: WRegister = WRegister.PARENT,
    isYoung: Boolean = false,
    content: @Composable () -> Unit,
) {
    val palette = when (register) {
        WRegister.PARENT -> WPalettes.parent
        WRegister.KID -> WPalettes.kid
        WRegister.TEEN -> WPalettes.teen
    }

    // Teen is the only register with a dark ground, and it is dark by design rather than
    // by system preference — the kid and parent registers stay light so a child's screen
    // never flips look between devices.
    val colorScheme = if (register == WRegister.TEEN) {
        darkColorScheme(
            primary = palette.accent.color,
            onPrimary = palette.onAccent.color,
            background = palette.background.color,
            onBackground = palette.text.color,
            surface = palette.surface.color,
            onSurface = palette.text.color,
            surfaceVariant = palette.accentSoft.color,
            onSurfaceVariant = palette.mutedText.color,
            secondary = palette.secondary.color,
        )
    } else {
        lightColorScheme(
            primary = palette.accent.color,
            onPrimary = palette.onAccent.color,
            background = palette.background.color,
            onBackground = palette.text.color,
            surface = palette.surface.color,
            onSurface = palette.text.color,
            surfaceVariant = palette.accentSoft.color,
            onSurfaceVariant = palette.mutedText.color,
            secondary = palette.secondary.color,
        )
    }

    CompositionLocalProvider(
        LocalWPalette provides palette,
        LocalWRegister provides register,
        LocalYoungMode provides isYoung,
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = WispelTypography,
            content = content,
        )
    }
}
