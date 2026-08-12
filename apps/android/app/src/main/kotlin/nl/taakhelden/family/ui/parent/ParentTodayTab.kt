package nl.taakhelden.family.ui.parent

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import nl.taakhelden.core.parent.ParentDashboardSnapshot
import nl.taakhelden.core.parent.ParentTaskBucket
import nl.taakhelden.core.parent.ParentTaskStatus
import nl.taakhelden.family.R
import nl.taakhelden.family.ui.components.WPanel
import nl.taakhelden.family.ui.theme.WDimens
import nl.taakhelden.family.ui.theme.WispelTheme
import nl.taakhelden.family.ui.theme.color

/**
 * "Vandaag": one card per child, their day split into to-do / awaiting / done.
 *
 * All three buckets always render, even when empty, so a parent reads the same shape for
 * every child instead of hunting for where a column went.
 */
@Composable
fun ParentTodayTab(
    snapshot: ParentDashboardSnapshot?,
    isLoading: Boolean,
) {
    val palette = WispelTheme.palette

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(WDimens.spacingXl),
        verticalArrangement = Arrangement.spacedBy(WDimens.spacingLg),
    ) {
        when {
            isLoading && snapshot == null -> WPanel {
                Text(
                    text = stringResource(R.string.parent_today_loading),
                    style = MaterialTheme.typography.titleMedium,
                    color = palette.text.color,
                )
                Text(
                    text = stringResource(R.string.parent_today_loading_detail),
                    color = palette.mutedText.color,
                )
            }

            snapshot != null && snapshot.todayChildren.isEmpty() -> WPanel {
                Text(
                    text = stringResource(R.string.parent_today_empty),
                    style = MaterialTheme.typography.titleMedium,
                    color = palette.text.color,
                )
                Text(
                    text = stringResource(R.string.parent_today_empty_detail),
                    color = palette.mutedText.color,
                )
            }

            snapshot != null -> snapshot.todayChildren.forEach { child ->
                WPanel {
                    Column {
                        Text(
                            text = "${child.avatar} ${child.displayName}",
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold,
                            color = palette.text.color,
                        )
                        Text(
                            text = pluralStringResource(
                                R.plurals.parent_today_balance,
                                child.balancePoints,
                                child.balancePoints,
                            ),
                            color = palette.mutedText.color,
                        )
                    }

                    if (child.tasks.isEmpty()) {
                        Text(
                            text = stringResource(
                                R.string.parent_today_child_quiet,
                                child.displayName,
                            ),
                            color = palette.mutedText.color,
                        )
                    } else {
                        child.groupedTasks.forEach { (bucket, items) ->
                            Column(
                                modifier = Modifier.fillMaxWidth(),
                                verticalArrangement = Arrangement.spacedBy(WDimens.spacingSm),
                            ) {
                                Text(
                                    text = stringResource(bucket.labelRes()),
                                    style = MaterialTheme.typography.labelMedium,
                                    color = palette.mutedText.color,
                                )
                                if (items.isEmpty()) {
                                    Text(
                                        text = stringResource(R.string.parent_bucket_empty),
                                        color = palette.mutedText.color,
                                    )
                                } else {
                                    items.forEach { task ->
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .background(
                                                    palette.background.color,
                                                    RoundedCornerShape(WDimens.radiusLarge),
                                                )
                                                .padding(WDimens.spacingMd),
                                            horizontalArrangement = Arrangement.spacedBy(
                                                WDimens.spacingSm,
                                            ),
                                        ) {
                                            task.icon?.let { Text(text = it) }
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(
                                                    text = task.title,
                                                    color = palette.text.color,
                                                )
                                                Text(
                                                    text = stringResource(
                                                        task.status.labelRes(),
                                                    ),
                                                    style = MaterialTheme.typography.bodyMedium,
                                                    color = palette.mutedText.color,
                                                )
                                            }
                                            Text(
                                                text = stringResource(
                                                    R.string.parent_today_points_short,
                                                    task.points,
                                                ),
                                                style = MaterialTheme.typography.labelMedium,
                                                color = palette.mutedText.color,
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

internal fun ParentTaskBucket.labelRes(): Int = when (this) {
    ParentTaskBucket.OPEN -> R.string.parent_bucket_open
    ParentTaskBucket.AWAITING_APPROVAL -> R.string.parent_bucket_awaiting
    ParentTaskBucket.DONE -> R.string.parent_bucket_done
}

internal fun ParentTaskStatus.labelRes(): Int = when (this) {
    ParentTaskStatus.OPEN -> R.string.parent_task_status_open
    ParentTaskStatus.SUBMITTED -> R.string.parent_task_status_submitted
    ParentTaskStatus.APPROVED -> R.string.parent_task_status_approved
    ParentTaskStatus.COMPLETED -> R.string.parent_task_status_completed
    ParentTaskStatus.OPEN_REDO -> R.string.parent_task_status_redo
}
