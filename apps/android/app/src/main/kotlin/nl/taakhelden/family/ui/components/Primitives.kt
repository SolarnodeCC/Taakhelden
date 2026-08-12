package nl.taakhelden.family.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import nl.taakhelden.core.designsystem.YoungMode
import nl.taakhelden.family.ui.theme.WDimens
import nl.taakhelden.family.ui.theme.WispelTheme
import nl.taakhelden.family.ui.theme.color

/**
 * The card every surface is built from.
 *
 * The kid register gets a large radius and a coloured shadow; the parent dashboard gets a
 * tighter radius and a barely-there elevation. Passing those two shapes through one
 * component is what keeps the registers consistent without duplicating markup.
 */
@Composable
fun WCard(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = WDimens.radiusXLarge,
    elevation: Dp = 6.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    val palette = WispelTheme.palette
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(cornerRadius),
        colors = CardDefaults.cardColors(containerColor = palette.surface.color),
        elevation = CardDefaults.cardElevation(defaultElevation = elevation),
    ) {
        Column(
            modifier = Modifier.padding(WDimens.spacingLg),
            verticalArrangement = Arrangement.spacedBy(WDimens.spacingMd),
            content = content,
        )
    }
}

/** Compact parent-register card: tighter radius, almost no shadow. */
@Composable
fun WPanel(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) = WCard(
    modifier = modifier,
    cornerRadius = WDimens.radiusMedium,
    elevation = 1.dp,
    content = content,
)

@Composable
fun WBadge(
    text: String,
    modifier: Modifier = Modifier,
) {
    val palette = WispelTheme.palette
    Text(
        text = text,
        modifier = modifier
            .background(palette.accentSoft.color, CircleShape)
            .padding(horizontal = WDimens.spacingMd, vertical = WDimens.spacingSm),
        color = palette.text.color,
        fontWeight = FontWeight.SemiBold,
        style = androidx.compose.material3.MaterialTheme.typography.labelMedium,
    )
}

/**
 * Primary action. Height follows young mode, so a 5-year-old gets a target they can
 * actually hit without the rest of the app growing.
 */
@Composable
fun WPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    leadingIcon: ImageVector? = null,
) {
    val palette = WispelTheme.palette
    val minHeight = if (WispelTheme.isYoung) {
        YoungMode.MIN_TAP_TARGET_DP.dp
    } else {
        WDimens.minTapTarget
    }

    Button(
        onClick = onClick,
        modifier = modifier.defaultMinSize(minHeight = minHeight),
        enabled = enabled,
        shape = RoundedCornerShape(WDimens.radiusLarge),
        colors = ButtonDefaults.buttonColors(
            containerColor = palette.accent.color,
            contentColor = palette.onAccent.color,
        ),
    ) {
        if (leadingIcon != null) {
            Icon(
                imageVector = leadingIcon,
                contentDescription = null,
                modifier = Modifier.padding(end = WDimens.spacingSm),
            )
        }
        Text(text = text, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun WSecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val palette = WispelTheme.palette
    val minHeight = if (WispelTheme.isYoung) {
        YoungMode.MIN_TAP_TARGET_DP.dp
    } else {
        WDimens.minTapTarget
    }

    OutlinedButton(
        onClick = onClick,
        modifier = modifier.defaultMinSize(minHeight = minHeight),
        enabled = enabled,
        shape = RoundedCornerShape(WDimens.radiusLarge),
    ) {
        Text(text = text, color = palette.text.color)
    }
}

@Composable
fun WTextButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    TextButton(onClick = onClick, modifier = modifier, enabled = enabled) {
        Text(text = text, color = WispelTheme.palette.accent.color)
    }
}

/**
 * Progress bar for savings goals and family goals.
 *
 * Always marked decorative: the number beside it already carries the meaning, and a
 * screen reader announcing "progress bar, 62 percent" on top of "Nog 30 punten tot een
 * ijsje" is noise.
 */
@Composable
fun WProgressBar(
    fraction: Float,
    modifier: Modifier = Modifier,
) {
    val palette = WispelTheme.palette
    LinearProgressIndicator(
        progress = { fraction.coerceIn(0f, 1f) },
        modifier = modifier
            .fillMaxWidth()
            .clearAndSetSemantics { },
        color = palette.accent.color,
        trackColor = palette.accentSoft.color,
    )
}

/** Small labelled pill used by the parent header for live/sync status. */
@Composable
fun WStatusPill(
    title: String,
    detail: String,
    modifier: Modifier = Modifier,
) {
    val palette = WispelTheme.palette
    Column(
        modifier = modifier
            .background(palette.surface.color, RoundedCornerShape(WDimens.radiusMedium))
            .padding(horizontal = WDimens.spacingMd, vertical = WDimens.spacingSm),
        verticalArrangement = Arrangement.spacedBy(WDimens.spacingXs),
    ) {
        Text(
            text = title,
            style = androidx.compose.material3.MaterialTheme.typography.labelMedium,
            color = palette.mutedText.color,
        )
        Text(
            text = detail,
            style = androidx.compose.material3.MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
            color = palette.text.color,
        )
    }
}

/** Row with a leading emoji and trailing content, the shape most list items take. */
@Composable
fun WEmojiRow(
    emoji: String,
    modifier: Modifier = Modifier,
    emojiSize: Dp = 28.dp,
    content: @Composable RowScope.() -> Unit,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(WDimens.spacingMd),
    ) {
        Box(modifier = Modifier.clearAndSetSemantics { }) {
            Text(
                text = emoji,
                style = androidx.compose.material3.MaterialTheme.typography.headlineSmall,
                fontSize = androidx.compose.ui.unit.TextUnit(
                    emojiSize.value,
                    androidx.compose.ui.unit.TextUnitType.Sp,
                ),
            )
        }
        content()
    }
}

/** Icon-only action with a mandatory description — never an unlabelled tap target. */
@Composable
fun WIconButton(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    IconButton(onClick = onClick, modifier = modifier, enabled = enabled) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            tint = WispelTheme.palette.accent.color,
        )
    }
}
