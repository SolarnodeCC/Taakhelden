package nl.taakhelden.family.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalAccessibilityManager
import androidx.compose.ui.semantics.clearAndSetSemantics
import nl.taakhelden.core.designsystem.WPalettes
import nl.taakhelden.family.ui.theme.color
import kotlin.random.Random

private data class ConfettiPiece(
    val startFraction: Float,
    val color: Color,
    val delayMillis: Int,
    val drift: Float,
)

/**
 * The reward moment overlay.
 *
 * With animation reduced, this is not "confetti minus the movement" — it is a single soft
 * glow, so the celebration still lands for a child who cannot use motion. The haptic and
 * chime fire either way (see `CelebrationService`).
 */
@Composable
fun ConfettiOverlay(
    token: Int,
    reduceMotion: Boolean,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier.fillMaxSize().clearAndSetSemantics { }) {
        if (reduceMotion) {
            ReduceMotionGlow(token)
        } else {
            ConfettiBurst(token)
        }
    }
}

@Composable
private fun ConfettiBurst(token: Int) {
    if (token <= 0) return

    val pieces = remember(token) {
        val colors = listOf(
            WPalettes.kid.accent.color,
            WPalettes.kid.secondary.color,
            WPalettes.kid.highlight.color,
            WPalettes.kid.accentSoft.color,
        )
        List(PIECE_COUNT) { index ->
            ConfettiPiece(
                startFraction = Random.nextFloat() * 0.8f + 0.1f,
                color = colors[index % colors.size],
                delayMillis = index * 20,
                drift = Random.nextFloat() * 0.1f - 0.05f,
            )
        }
    }

    val progress = remember(token) { Animatable(0f) }
    LaunchedEffect(token) {
        progress.snapTo(0f)
        progress.animateTo(
            targetValue = 1f,
            animationSpec = tween(durationMillis = DURATION_MS, easing = LinearEasing),
        )
    }

    Canvas(modifier = Modifier.fillMaxSize()) {
        pieces.forEach { piece ->
            // Each piece has its own delay, so they fall as a burst rather than a wall.
            val delayFraction = piece.delayMillis.toFloat() / DURATION_MS
            val local = ((progress.value - delayFraction) / (1f - delayFraction)).coerceIn(0f, 1f)
            if (local <= 0f) return@forEach

            val x = (piece.startFraction + piece.drift * local) * size.width
            val y = size.height * 0.2f + local * size.height * 0.6f
            drawRect(
                color = piece.color.copy(alpha = (1f - local).coerceIn(0f, 1f)),
                topLeft = Offset(x, y),
                size = Size(PIECE_WIDTH, PIECE_HEIGHT),
            )
        }
    }
}

@Composable
private fun ReduceMotionGlow(token: Int) {
    if (token <= 0) return

    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(token) {
        visible = true
        kotlinx.coroutines.delay(GLOW_DURATION_MS)
        visible = false
    }

    if (!visible) return
    val glowColor = WPalettes.kid.accent.color.copy(alpha = 0.25f)
    Canvas(modifier = Modifier.fillMaxSize()) {
        drawCircle(color = glowColor, radius = size.minDimension * 0.18f)
    }
}

/**
 * Whether the platform asks us to reduce animation.
 *
 * Compose has no direct "reduce motion" flag on Android, so we take the accessibility
 * manager's recommended timeout as the signal: a user who has extended it is telling the
 * system they need less motion and more time.
 */
@Composable
fun rememberReduceMotion(): Boolean {
    val accessibilityManager = LocalAccessibilityManager.current ?: return false
    val recommended = accessibilityManager.calculateRecommendedTimeoutMillis(
        originalTimeoutMillis = BASE_TIMEOUT_MS,
        containsIcons = false,
        containsText = true,
        containsControls = false,
    )
    return recommended > BASE_TIMEOUT_MS
}

private const val PIECE_COUNT = 24
private const val DURATION_MS = 1100
private const val PIECE_WIDTH = 8f
private const val PIECE_HEIGHT = 12f
private const val GLOW_DURATION_MS = 450L
private const val BASE_TIMEOUT_MS = 1000L
