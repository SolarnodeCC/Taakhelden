package nl.taakhelden.family.ui.familygoal

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import kotlinx.coroutines.launch
import nl.taakhelden.core.child.FamilyGoalCreateStatus
import nl.taakhelden.core.child.ParentFamilyGoalSettingsState
import nl.taakhelden.core.child.ParentFamilyGoalSettingsStore
import nl.taakhelden.family.R
import nl.taakhelden.family.ui.components.WIconButton
import nl.taakhelden.family.ui.components.WPanel
import nl.taakhelden.family.ui.components.WPrimaryButton
import nl.taakhelden.family.ui.theme.WDimens
import nl.taakhelden.family.ui.theme.WispelTheme
import nl.taakhelden.family.ui.theme.color

@Composable
fun ParentFamilyGoalSettings(
    store: ParentFamilyGoalSettingsStore,
    modifier: Modifier = Modifier,
) {
    val palette = WispelTheme.palette
    val scope = rememberCoroutineScope()
    val state by store.state.collectAsState()

    WPanel(modifier = modifier) {
        Text(
            text = stringResource(R.string.goal_parent_title),
            style = MaterialTheme.typography.titleMedium,
            color = palette.text.color,
        )
        Text(
            text = stringResource(R.string.goal_parent_detail),
            style = MaterialTheme.typography.bodyMedium,
            color = palette.mutedText.color,
        )

        OutlinedTextField(
            value = state.title,
            onValueChange = store::updateTitle,
            label = { Text(stringResource(R.string.goal_parent_name)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = state.icon,
            onValueChange = store::updateIcon,
            label = { Text(stringResource(R.string.goal_parent_icon)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        WStepperRow(
            label = stringResource(R.string.goal_parent_target, state.targetPoints),
            onDecrease = {
                store.updateTargetPoints(
                    state.targetPoints - ParentFamilyGoalSettingsState.TARGET_STEP,
                )
            },
            onIncrease = {
                store.updateTargetPoints(
                    state.targetPoints + ParentFamilyGoalSettingsState.TARGET_STEP,
                )
            },
        )

        WPrimaryButton(
            text = stringResource(R.string.goal_parent_create),
            onClick = { scope.launch { store.create() } },
            enabled = state.canCreate,
        )

        state.status?.let { status ->
            Text(
                text = stringResource(
                    when (status) {
                        FamilyGoalCreateStatus.CREATED -> R.string.goal_parent_created
                        FamilyGoalCreateStatus.FAILED -> R.string.goal_parent_error
                    },
                ),
                style = MaterialTheme.typography.bodyMedium,
                color = palette.mutedText.color,
            )
        }
    }
}

/** Compose has no Stepper; this is the labelled −/+ pair the parent surfaces use. */
@Composable
fun WStepperRow(
    label: String,
    onDecrease: () -> Unit,
    onIncrease: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val palette = WispelTheme.palette
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(text = label, color = palette.text.color)
        Row(horizontalArrangement = Arrangement.spacedBy(WDimens.spacingSm)) {
            WIconButton(
                icon = Icons.Filled.Remove,
                contentDescription = stringResource(R.string.parent_stepper_decrease),
                onClick = onDecrease,
            )
            WIconButton(
                icon = Icons.Filled.Add,
                contentDescription = stringResource(R.string.parent_stepper_increase),
                onClick = onIncrease,
            )
        }
    }
}
