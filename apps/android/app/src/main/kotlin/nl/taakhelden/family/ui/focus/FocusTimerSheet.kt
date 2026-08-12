package nl.taakhelden.family.ui.focus

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Icon
import nl.taakhelden.core.focus.FocusTimerPhase
import nl.taakhelden.core.focus.FocusTimerService
import nl.taakhelden.family.R
import nl.taakhelden.family.ui.components.WCard
import nl.taakhelden.family.ui.components.WPrimaryButton
import nl.taakhelden.family.ui.components.WSecondaryButton
import nl.taakhelden.family.ui.components.rememberReduceMotion
import nl.taakhelden.family.ui.theme.WDimens
import nl.taakhelden.family.ui.theme.WispelTheme
import nl.taakhelden.family.ui.theme.color

private val FOCUS_DURATIONS_MINUTES = listOf(10, 15, 20, 25)

/**
 * The homework focus timer.
 *
 * It awards nothing: no points for elapsed time, no server session (WS-FOCUS). When the
 * timer finishes it *offers* to check the task off — completing is still the child's
 * decision, and "misschien later" is a first-class answer.
 */
@Composable
fun FocusTimerSheet(
    taskTitle: String,
    timer: FocusTimerService,
    onComplete: () -> Unit,
    onDismiss: () -> Unit,
) {
    val palette = WispelTheme.palette
    val isYoung = WispelTheme.isYoung
    val reduceMotion = rememberReduceMotion()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val state by timer.state.collectAsState()

    var selectedMinutes by remember { mutableIntStateOf(FOCUS_DURATIONS_MINUTES.last()) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = palette.background.color,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(WDimens.spacingXl),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(WDimens.spacingXl),
        ) {
            Text(
                text = stringResource(R.string.focus_title),
                style = MaterialTheme.typography.titleMedium,
                color = palette.text.color,
            )

            TimerRing(
                phase = state.phase,
                progress = state.progress.toFloat(),
                remainingLabel = state.formattedRemaining,
                selectedMinutes = selectedMinutes,
                reduceMotion = reduceMotion,
            )

            WCard {
                Text(
                    text = taskTitle,
                    style = MaterialTheme.typography.titleMedium,
                    color = palette.text.color,
                )
            }

            if (state.phase == FocusTimerPhase.IDLE) {
                Text(
                    text = stringResource(R.string.focus_duration_pick),
                    color = palette.mutedText.color,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(WDimens.spacingSm)) {
                    FOCUS_DURATIONS_MINUTES.forEach { minutes ->
                        WSecondaryButton(
                            text = stringResource(R.string.focus_duration_format, minutes),
                            onClick = { selectedMinutes = minutes },
                        )
                    }
                }
                WPrimaryButton(
                    text = stringResource(R.string.focus_start),
                    onClick = { timer.start(selectedMinutes * 60L) },
                    modifier = Modifier.fillMaxWidth(),
                )
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(WDimens.spacingMd),
                ) {
                    when (state.phase) {
                        FocusTimerPhase.RUNNING -> WSecondaryButton(
                            text = stringResource(R.string.focus_pause),
                            onClick = timer::pause,
                        )

                        FocusTimerPhase.PAUSED -> WPrimaryButton(
                            text = stringResource(R.string.focus_resume),
                            onClick = { timer.start(selectedMinutes * 60L) },
                        )

                        else -> Unit
                    }
                    WSecondaryButton(
                        text = stringResource(R.string.focus_stop),
                        onClick = timer::stop,
                    )
                }
            }

            if (state.phase == FocusTimerPhase.COMPLETED) {
                WCard {
                    Text(
                        text = stringResource(R.string.focus_complete_offer_title),
                        style = MaterialTheme.typography.titleMedium,
                        color = palette.text.color,
                    )
                    Text(
                        text = stringResource(R.string.focus_complete_offer_detail),
                        color = palette.mutedText.color,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(WDimens.spacingSm)) {
                        WPrimaryButton(
                            text = stringResource(R.string.focus_complete_offer_yes),
                            onClick = onComplete,
                        )
                        WSecondaryButton(
                            text = stringResource(R.string.focus_complete_offer_later),
                            onClick = onDismiss,
                        )
                    }
                }
            }

            if (isYoung) {
                // Young mode keeps the sheet short: no duration grid, one big start button.
                Text(
                    text = stringResource(R.string.focus_ready),
                    color = palette.mutedText.color,
                )
            }
        }
    }
}

@Composable
private fun TimerRing(
    phase: FocusTimerPhase,
    progress: Float,
    remainingLabel: String,
    selectedMinutes: Int,
    reduceMotion: Boolean,
) {
    val palette = WispelTheme.palette
    val isYoung = WispelTheme.isYoung

    val animatedProgress by animateFloatAsState(
        targetValue = if (phase == FocusTimerPhase.IDLE) 0f else progress,
        animationSpec = if (reduceMotion) tween(0) else tween(durationMillis = 500),
        label = "focus-progress",
    )

    val accessibilityLabel = when (phase) {
        FocusTimerPhase.IDLE -> stringResource(R.string.focus_a11y_idle)
        FocusTimerPhase.RUNNING -> stringResource(R.string.focus_a11y_running, remainingLabel)
        FocusTimerPhase.PAUSED -> stringResource(R.string.focus_a11y_paused, remainingLabel)
        FocusTimerPhase.COMPLETED -> stringResource(R.string.focus_a11y_done)
    }

    Box(
        modifier = Modifier
            .size(RING_SIZE)
            .semantics(mergeDescendants = true) { contentDescription = accessibilityLabel },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(modifier = Modifier.size(RING_SIZE).clearAndSetSemantics { }) {
            val stroke = Stroke(width = RING_STROKE, cap = StrokeCap.Round)
            val inset = RING_STROKE / 2
            val arcSize = Size(size.width - RING_STROKE, size.height - RING_STROKE)

            drawArc(
                color = palette.accent.color.copy(alpha = 0.15f),
                startAngle = 0f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = androidx.compose.ui.geometry.Offset(inset, inset),
                size = arcSize,
                style = stroke,
            )
            drawArc(
                color = palette.accent.color,
                startAngle = -90f,
                sweepAngle = 360f * animatedProgress.coerceIn(0f, 1f),
                useCenter = false,
                topLeft = androidx.compose.ui.geometry.Offset(inset, inset),
                size = arcSize,
                style = stroke,
            )
        }

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(WDimens.spacingXs),
            modifier = Modifier.clearAndSetSemantics { },
        ) {
            when (phase) {
                FocusTimerPhase.IDLE -> {
                    Text(
                        text = stringResource(R.string.focus_duration_format, selectedMinutes),
                        fontSize = if (isYoung) 44.sp else 36.sp,
                        fontWeight = FontWeight.Bold,
                        color = palette.text.color,
                    )
                    Text(
                        text = stringResource(R.string.focus_ready),
                        color = palette.mutedText.color,
                    )
                }

                FocusTimerPhase.COMPLETED -> {
                    Icon(
                        imageVector = Icons.Filled.CheckCircle,
                        contentDescription = null,
                        tint = palette.accent.color,
                        modifier = Modifier.size(48.dp),
                    )
                    Text(
                        text = stringResource(R.string.focus_done),
                        style = MaterialTheme.typography.titleMedium,
                        color = palette.text.color,
                    )
                }

                else -> {
                    Text(
                        text = remainingLabel,
                        fontSize = if (isYoung) 52.sp else 44.sp,
                        fontWeight = FontWeight.Bold,
                        color = palette.text.color,
                    )
                    Text(
                        text = stringResource(
                            if (phase == FocusTimerPhase.PAUSED) {
                                R.string.focus_paused
                            } else {
                                R.string.focus_running
                            },
                        ),
                        color = palette.mutedText.color,
                    )
                }
            }
        }
    }
}

private val RING_SIZE = 220.dp
private const val RING_STROKE = 24f
