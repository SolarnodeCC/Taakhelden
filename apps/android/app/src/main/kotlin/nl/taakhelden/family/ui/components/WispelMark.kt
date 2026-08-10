package nl.taakhelden.family.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import nl.taakhelden.family.ui.theme.WDimens
import nl.taakhelden.family.ui.theme.WispelTheme
import nl.taakhelden.family.ui.theme.color

/**
 * Wispel mark v1 — soft Ster with a trailing wisp.
 *
 * Path geometry is transcribed from `apps/web/public/brand/mark.svg` (viewBox 0 0 48 48),
 * the same source the iOS `WispelMark` uses, so the three platforms draw one mark.
 */
@Composable
fun WispelMark(
    modifier: Modifier = Modifier,
    size: Dp = 28.dp,
    tint: Color = WispelTheme.palette.accent.color,
) {
    Canvas(modifier = modifier.size(size).clearAndSetSemantics { }) {
        val scale = this.size.minDimension / 48f
        fun p(x: Float, y: Float) = androidx.compose.ui.geometry.Offset(x * scale, y * scale)

        val star = Path().apply {
            moveTo(p(24f, 5f).x, p(24f, 5f).y)
            cubicTo(
                p(24.72f, 5f).x, p(24.72f, 5f).y,
                p(25.36f, 5.42f).x, p(25.36f, 5.42f).y,
                p(25.62f, 6.1f).x, p(25.62f, 6.1f).y,
            )
            lineTo(p(29.17f, 15.15f).x, p(29.17f, 15.15f).y)
            lineTo(p(38.82f, 15.65f).x, p(38.82f, 15.65f).y)
            cubicTo(
                p(40.32f, 15.73f).x, p(40.32f, 15.73f).y,
                p(40.94f, 17.63f).x, p(40.94f, 17.63f).y,
                p(39.8f, 18.55f).x, p(39.8f, 18.55f).y,
            )
            lineTo(p(32.45f, 24.5f).x, p(32.45f, 24.5f).y)
            lineTo(p(34.95f, 33.9f).x, p(34.95f, 33.9f).y)
            cubicTo(
                p(35.32f, 35.32f).x, p(35.32f, 35.32f).y,
                p(33.75f, 36.45f).x, p(33.75f, 36.45f).y,
                p(32.5f, 35.7f).x, p(32.5f, 35.7f).y,
            )
            lineTo(p(24f, 30.35f).x, p(24f, 30.35f).y)
            lineTo(p(15.5f, 35.7f).x, p(15.5f, 35.7f).y)
            cubicTo(
                p(14.25f, 36.45f).x, p(14.25f, 36.45f).y,
                p(12.68f, 35.32f).x, p(12.68f, 35.32f).y,
                p(13.05f, 33.9f).x, p(13.05f, 33.9f).y,
            )
            lineTo(p(15.55f, 24.5f).x, p(15.55f, 24.5f).y)
            lineTo(p(8.2f, 18.55f).x, p(8.2f, 18.55f).y)
            cubicTo(
                p(7.06f, 17.63f).x, p(7.06f, 17.63f).y,
                p(7.68f, 15.73f).x, p(7.68f, 15.73f).y,
                p(9.18f, 15.65f).x, p(9.18f, 15.65f).y,
            )
            lineTo(p(18.83f, 15.15f).x, p(18.83f, 15.15f).y)
            lineTo(p(22.38f, 6.1f).x, p(22.38f, 6.1f).y)
            cubicTo(
                p(22.64f, 5.42f).x, p(22.64f, 5.42f).y,
                p(23.28f, 5f).x, p(23.28f, 5f).y,
                p(24f, 5f).x, p(24f, 5f).y,
            )
            close()
        }
        drawPath(star, color = tint)

        val wisp = Path().apply {
            moveTo(p(36.5f, 34.5f).x, p(36.5f, 34.5f).y)
            cubicTo(
                p(39.7f, 36.3f).x, p(39.7f, 36.3f).y,
                p(42.1f, 39.6f).x, p(42.1f, 39.6f).y,
                p(42.7f, 43.5f).x, p(42.7f, 43.5f).y,
            )
        }
        drawPath(
            path = wisp,
            color = tint,
            style = Stroke(width = 2.75f * scale, cap = StrokeCap.Round),
        )
    }
}

/** Mark plus the word "Wispel", announced as one thing. */
@Composable
fun WispelWordmark(
    modifier: Modifier = Modifier,
    markSize: Dp = 36.dp,
) {
    val palette = WispelTheme.palette
    Row(
        modifier = modifier.semantics(mergeDescendants = true) { contentDescription = "Wispel" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(WDimens.spacingSm),
    ) {
        WispelMark(size = markSize, tint = palette.accent.color)
        Text(
            text = "Wispel",
            style = MaterialTheme.typography.displaySmall,
            fontWeight = FontWeight.Bold,
            color = palette.accent.color,
        )
    }
}
