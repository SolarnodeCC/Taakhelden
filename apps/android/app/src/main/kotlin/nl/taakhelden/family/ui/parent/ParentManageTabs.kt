package nl.taakhelden.family.ui.parent

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import kotlinx.coroutines.launch
import nl.taakhelden.core.parent.ParentModeState
import nl.taakhelden.core.parent.ParentModeStore
import nl.taakhelden.family.R
import nl.taakhelden.family.ui.components.WPanel
import nl.taakhelden.family.ui.components.WPrimaryButton
import nl.taakhelden.family.ui.components.WSecondaryButton
import nl.taakhelden.family.ui.familygoal.WStepperRow
import nl.taakhelden.family.ui.theme.WDimens
import nl.taakhelden.family.ui.theme.WispelTheme
import nl.taakhelden.family.ui.theme.color

private const val TASK_POINTS_STEP = 1
private const val REWARD_PRICE_STEP = 5

@Composable
fun ParentTasksTab(
    store: ParentModeStore,
    state: ParentModeState,
) {
    val palette = WispelTheme.palette
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(WDimens.spacingXl),
        verticalArrangement = Arrangement.spacedBy(WDimens.spacingLg),
    ) {
        WPanel {
            Text(
                text = stringResource(R.string.parent_tasks_create_title),
                style = MaterialTheme.typography.titleMedium,
                color = palette.text.color,
            )
            OutlinedTextField(
                value = state.draftTaskTitle,
                onValueChange = store::updateDraftTaskTitle,
                placeholder = { Text(stringResource(R.string.parent_tasks_create_placeholder)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            WStepperRow(
                label = stringResource(
                    R.string.parent_tasks_create_points,
                    state.draftTaskPoints,
                ),
                onDecrease = { store.updateDraftTaskPoints(state.draftTaskPoints - TASK_POINTS_STEP) },
                onIncrease = { store.updateDraftTaskPoints(state.draftTaskPoints + TASK_POINTS_STEP) },
            )
            WPrimaryButton(
                text = stringResource(R.string.parent_tasks_create_button),
                onClick = {
                    // A new task is assigned to every child in today's view — the same
                    // default the iOS app uses, so a parent is never asked to pick before
                    // they have even seen the task exist.
                    val childIds = state.snapshot?.todayChildren?.map { it.id }.orEmpty()
                    scope.launch { store.createTaskFromDraft(childIds) }
                },
                enabled = state.draftTaskTitle.isNotBlank(),
            )
        }

        val tasks = state.snapshot?.managedTasks.orEmpty()
        if (tasks.isEmpty()) {
            Text(
                text = stringResource(R.string.parent_tasks_empty),
                color = palette.mutedText.color,
            )
        } else {
            tasks.forEach { task ->
                WPanel {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(WDimens.spacingMd),
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "${task.icon ?: "⭐️"} ${task.title}",
                                style = MaterialTheme.typography.titleMedium,
                                color = palette.text.color,
                            )
                            Text(
                                text = stringResource(
                                    R.string.parent_tasks_meta,
                                    task.points,
                                    task.assigneeCount,
                                ),
                                color = palette.mutedText.color,
                            )
                        }
                        WSecondaryButton(
                            text = stringResource(R.string.parent_tasks_archive),
                            onClick = { scope.launch { store.archiveTask(task.id) } },
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ParentRewardsTab(
    store: ParentModeStore,
    state: ParentModeState,
) {
    val palette = WispelTheme.palette
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(WDimens.spacingXl),
        verticalArrangement = Arrangement.spacedBy(WDimens.spacingLg),
    ) {
        WPanel {
            Text(
                text = stringResource(R.string.parent_rewards_create_title),
                style = MaterialTheme.typography.titleMedium,
                color = palette.text.color,
            )
            OutlinedTextField(
                value = state.draftRewardTitle,
                onValueChange = store::updateDraftRewardTitle,
                placeholder = { Text(stringResource(R.string.parent_rewards_create_placeholder)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            WStepperRow(
                label = stringResource(
                    R.string.parent_rewards_create_price,
                    state.draftRewardPrice,
                ),
                onDecrease = {
                    store.updateDraftRewardPrice(state.draftRewardPrice - REWARD_PRICE_STEP)
                },
                onIncrease = {
                    store.updateDraftRewardPrice(state.draftRewardPrice + REWARD_PRICE_STEP)
                },
            )
            WPrimaryButton(
                text = stringResource(R.string.parent_rewards_create_button),
                onClick = { scope.launch { store.createRewardFromDraft() } },
                enabled = state.draftRewardTitle.isNotBlank(),
            )
        }

        val rewards = state.snapshot?.managedRewards.orEmpty()
        if (rewards.isEmpty()) {
            Text(
                text = stringResource(R.string.parent_rewards_empty),
                color = palette.mutedText.color,
            )
        } else {
            rewards.forEach { reward ->
                WPanel {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(WDimens.spacingMd),
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "${reward.icon ?: "🎁"} ${reward.title}",
                                style = MaterialTheme.typography.titleMedium,
                                color = palette.text.color,
                            )
                            Text(
                                text = pluralStringResource(
                                    R.plurals.parent_rewards_meta,
                                    reward.price,
                                    reward.price,
                                ),
                                color = palette.mutedText.color,
                            )
                        }
                        WSecondaryButton(
                            text = stringResource(R.string.parent_rewards_archive),
                            onClick = { scope.launch { store.archiveReward(reward.id) } },
                        )
                    }
                }
            }
        }
    }
}
