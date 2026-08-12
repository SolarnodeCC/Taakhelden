package nl.taakhelden.family.ui.familygoal

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.sp
import nl.taakhelden.core.api.FamilyGoalProgressDTO
import nl.taakhelden.core.designsystem.HeroProgress
import nl.taakhelden.family.R
import nl.taakhelden.family.platform.SpeechBus
import nl.taakhelden.family.ui.components.WCard
import nl.taakhelden.family.ui.components.WProgressBar
import nl.taakhelden.family.ui.components.YoungSpeakButton
import nl.taakhelden.family.ui.theme.WDimens
import nl.taakhelden.family.ui.theme.WispelTheme
import nl.taakhelden.family.ui.theme.color

/**
 * The shared family goal on a child's day.
 *
 * Cooperative by design: one goal for the whole family, with no per-child breakdown and
 * no ranking between siblings. The copy is always "together", never "you owe".
 */
@Composable
fun FamilyGoalCard(
    progress: FamilyGoalProgressDTO,
    isTeen: Boolean,
    speechBus: SpeechBus,
    modifier: Modifier = Modifier,
) {
    val palette = WispelTheme.palette
    val isYoung = WispelTheme.isYoung
    val fraction = HeroProgress.goalFraction(progress.earnedPoints, progress.targetPoints)

    WCard(modifier = modifier.semantics(mergeDescendants = true) { }) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(WDimens.spacingMd),
        ) {
            Text(
                text = progress.icon,
                fontSize = if (isYoung) 40.sp else 28.sp,
                modifier = Modifier.clearAndSetSemantics { },
            )
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(WDimens.spacingSm),
            ) {
                Text(
                    text = stringResource(R.string.goal_card_title),
                    style = MaterialTheme.typography.titleMedium,
                    color = palette.text.color,
                )
                Text(text = progress.title, color = palette.text.color)
                WProgressBar(fraction = fraction.toFloat())
                Text(
                    text = stringResource(
                        if (isTeen) R.string.goal_card_progress_teen else R.string.goal_card_progress,
                        progress.earnedPoints,
                        progress.targetPoints,
                    ),
                    style = MaterialTheme.typography.bodyMedium,
                    color = palette.mutedText.color,
                )
            }
            if (isYoung) {
                YoungSpeakButton(
                    text = stringResource(
                        R.string.goal_card_speak,
                        progress.earnedPoints,
                        progress.targetPoints,
                    ),
                    speechBus = speechBus,
                )
            }
        }
    }
}
