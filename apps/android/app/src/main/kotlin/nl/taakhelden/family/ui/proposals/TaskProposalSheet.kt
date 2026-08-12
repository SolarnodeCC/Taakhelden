package nl.taakhelden.family.ui.proposals

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import kotlinx.coroutines.launch
import nl.taakhelden.core.api.ProposalStatus
import nl.taakhelden.core.api.TaskProposalDTO
import nl.taakhelden.core.child.ProposalFormState
import nl.taakhelden.core.child.ProposalListState
import nl.taakhelden.core.child.ProposalSubmitState
import nl.taakhelden.core.child.TaskProposalStore
import nl.taakhelden.family.R
import nl.taakhelden.family.ui.components.WCard
import nl.taakhelden.family.ui.components.WPrimaryButton
import nl.taakhelden.family.ui.components.WSecondaryButton
import nl.taakhelden.family.ui.familygoal.WStepperRow
import nl.taakhelden.family.ui.theme.WDimens
import nl.taakhelden.family.ui.theme.WispelTheme
import nl.taakhelden.family.ui.theme.color

private const val POINTS_STEP = 5

/** Entry point on a teen's Mijn Dag. */
@Composable
fun ProposalSheetButton(
    store: TaskProposalStore,
    modifier: Modifier = Modifier,
) {
    var showSheet by remember { mutableStateOf(false) }

    WSecondaryButton(
        text = stringResource(R.string.proposal_button),
        onClick = { showSheet = true },
        modifier = modifier.fillMaxWidth(),
    )

    if (showSheet) {
        TaskProposalSheet(store = store, onDismiss = { showSheet = false })
    }
}

/**
 * WS-PROPOSAL: a teen proposes a task, a parent decides.
 *
 * The teen suggests the points but never sets them — that stays a parent decision, so a
 * proposal can never become a way to award yourself points.
 */
@Composable
fun TaskProposalSheet(
    store: TaskProposalStore,
    onDismiss: () -> Unit,
) {
    val palette = WispelTheme.palette
    val scope = rememberCoroutineScope()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    val form by store.form.collectAsState()
    val listState by store.listState.collectAsState()
    val submitState by store.submitState.collectAsState()

    LaunchedEffect(store) { store.loadProposals() }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = palette.background.color,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(WDimens.spacingXl),
            verticalArrangement = Arrangement.spacedBy(WDimens.spacingLg),
        ) {
            Text(
                text = stringResource(R.string.proposal_form_title),
                style = MaterialTheme.typography.titleMedium,
                color = palette.text.color,
            )
            Text(
                text = stringResource(R.string.proposal_form_detail),
                style = MaterialTheme.typography.bodyMedium,
                color = palette.mutedText.color,
            )

            OutlinedTextField(
                value = form.title,
                onValueChange = store::updateTitle,
                label = { Text(stringResource(R.string.proposal_field_title)) },
                placeholder = { Text(stringResource(R.string.proposal_field_title_placeholder)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            Text(
                text = stringResource(R.string.proposal_field_category),
                style = MaterialTheme.typography.bodyMedium,
                color = palette.mutedText.color,
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(WDimens.spacingSm),
            ) {
                ProposalFormState.CATEGORIES.forEach { category ->
                    CategoryChip(
                        category = category,
                        isSelected = form.category == category,
                        onSelect = { store.updateCategory(category) },
                    )
                }
            }

            WStepperRow(
                label = stringResource(
                    R.string.proposal_field_points_label,
                    form.suggestedPoints,
                ),
                onDecrease = { store.updateSuggestedPoints(form.suggestedPoints - POINTS_STEP) },
                onIncrease = { store.updateSuggestedPoints(form.suggestedPoints + POINTS_STEP) },
            )

            OutlinedTextField(
                value = form.note,
                onValueChange = store::updateNote,
                label = { Text(stringResource(R.string.proposal_field_note)) },
                placeholder = { Text(stringResource(R.string.proposal_field_note_placeholder)) },
                minLines = 3,
                modifier = Modifier.fillMaxWidth(),
            )

            when (submitState) {
                is ProposalSubmitState.Error -> Text(
                    text = stringResource(R.string.proposal_submit_error),
                    style = MaterialTheme.typography.bodyMedium,
                    color = palette.accent.color,
                )

                is ProposalSubmitState.Success -> Text(
                    text = stringResource(R.string.proposal_submit_success),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = palette.accent.color,
                )

                else -> Unit
            }

            WPrimaryButton(
                text = stringResource(R.string.proposal_submit),
                onClick = { scope.launch { store.submit() } },
                modifier = Modifier.fillMaxWidth(),
                enabled = store.canSubmit,
            )

            Text(
                text = stringResource(R.string.proposal_list_title),
                style = MaterialTheme.typography.titleMedium,
                color = palette.text.color,
            )

            when (val current = listState) {
                is ProposalListState.Idle, is ProposalListState.Loading -> Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(WDimens.spacingSm),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    CircularProgressIndicator(color = palette.accent.color)
                    Text(
                        text = stringResource(R.string.proposal_list_loading),
                        color = palette.mutedText.color,
                    )
                }

                is ProposalListState.Loaded -> if (current.items.isEmpty()) {
                    Text(
                        text = stringResource(R.string.proposal_list_empty),
                        color = palette.mutedText.color,
                    )
                } else {
                    current.items.forEach { ProposalRow(it) }
                }

                is ProposalListState.Error -> Text(
                    text = stringResource(R.string.proposal_load_error),
                    color = palette.mutedText.color,
                )
            }
        }
    }
}

@Composable
private fun CategoryChip(
    category: String,
    isSelected: Boolean,
    onSelect: () -> Unit,
) {
    WSecondaryButton(
        text = stringResource(
            when (category) {
                "homework" -> R.string.proposal_category_homework
                "household" -> R.string.proposal_category_household
                "selfcare" -> R.string.proposal_category_selfcare
                else -> R.string.proposal_category_custom
            },
        ),
        onClick = onSelect,
        modifier = if (isSelected) {
            Modifier.background(
                WispelTheme.palette.accentSoft.color,
                CircleShape,
            )
        } else {
            Modifier
        },
    )
}

@Composable
private fun ProposalRow(proposal: TaskProposalDTO) {
    val palette = WispelTheme.palette

    WCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(WDimens.spacingMd),
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(WDimens.spacingXs),
            ) {
                Text(
                    text = proposal.title,
                    style = MaterialTheme.typography.titleMedium,
                    color = palette.text.color,
                )
                Text(
                    text = stringResource(
                        R.string.proposal_suggested_points,
                        proposal.suggestedPoints,
                    ),
                    style = MaterialTheme.typography.bodyMedium,
                    color = palette.mutedText.color,
                )
                proposal.note?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodyMedium,
                        color = palette.mutedText.color,
                    )
                }
            }
            Text(
                text = stringResource(
                    when (proposal.status) {
                        ProposalStatus.PENDING -> R.string.proposal_status_pending
                        ProposalStatus.APPROVED -> R.string.proposal_status_approved
                        ProposalStatus.DECLINED -> R.string.proposal_status_declined
                    },
                ),
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                color = palette.accent.color,
            )
        }
    }
}
