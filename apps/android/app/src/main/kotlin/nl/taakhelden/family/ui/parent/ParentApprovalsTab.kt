package nl.taakhelden.family.ui.parent

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import nl.taakhelden.core.parent.ApprovalQueueItem
import nl.taakhelden.core.parent.BulkApprovalValidation
import nl.taakhelden.core.parent.ParentModeState
import nl.taakhelden.core.parent.ParentModeStore
import nl.taakhelden.family.R
import nl.taakhelden.family.ui.components.WBadge
import nl.taakhelden.family.ui.components.WPanel
import nl.taakhelden.family.ui.components.WPrimaryButton
import nl.taakhelden.family.ui.components.WSecondaryButton
import nl.taakhelden.family.ui.theme.WDimens
import nl.taakhelden.family.ui.theme.WispelTheme
import nl.taakhelden.family.ui.theme.color
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

/**
 * The approval queue, grouped per child.
 *
 * Bulk approve sits pinned at the bottom rather than inline: it is the one action here
 * that touches several ledger entries at once, so it should be a deliberate step, not
 * something a thumb finds while scrolling.
 */
@Composable
fun ParentApprovalsTab(
    store: ParentModeStore,
    state: ParentModeState,
    onRedo: (ApprovalQueueItem) -> Unit,
) {
    val palette = WispelTheme.palette
    val scope = rememberCoroutineScope()
    val sections = state.snapshot?.approvalSections.orEmpty()
    val validation = store.bulkApprovalValidation()

    Column(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(WDimens.spacingXl),
            verticalArrangement = Arrangement.spacedBy(WDimens.spacingLg),
        ) {
            if (state.bulkFailureCount > 0) {
                Text(
                    text = pluralStringResource(
                        R.plurals.parent_bulk_failures,
                        state.bulkFailureCount,
                        state.bulkFailureCount,
                    ),
                    style = MaterialTheme.typography.bodyMedium,
                    color = palette.mutedText.color,
                )
            }

            if (sections.isEmpty()) {
                WPanel {
                    Text(
                        text = stringResource(R.string.parent_approvals_empty),
                        style = MaterialTheme.typography.titleMedium,
                        color = palette.text.color,
                    )
                    Text(
                        text = stringResource(R.string.parent_approvals_empty_detail),
                        color = palette.mutedText.color,
                    )
                }
            } else {
                sections.forEach { section ->
                    WPanel {
                        Text(
                            text = "${section.childAvatar} ${section.childName}",
                            style = MaterialTheme.typography.titleMedium,
                            color = palette.text.color,
                        )
                        section.items.forEach { item ->
                            ApprovalCard(
                                item = item,
                                isSelected = state.selectedApprovalIds.contains(item.id),
                                onToggleSelection = { store.toggleSelection(item) },
                                onApprove = { scope.launch { store.approve(item) } },
                                onRedo = { onRedo(item) },
                                onOpenPhoto = {
                                    scope.launch { store.openFullscreenPhoto(item) }
                                },
                            )
                        }
                    }
                }
            }
        }

        BulkApprovalBar(
            validation = validation,
            isBusy = state.isBulkApproving,
            selectionCount = state.selectedApprovalIds.size,
            acknowledged = state.acknowledgedBulkPhotoReview,
            onAcknowledgeChange = store::setAcknowledgedBulkPhotoReview,
            onApprove = { scope.launch { store.approveSelectedItems() } },
        )
    }
}

@Composable
private fun ApprovalCard(
    item: ApprovalQueueItem,
    isSelected: Boolean,
    onToggleSelection: () -> Unit,
    onApprove: () -> Unit,
    onRedo: () -> Unit,
    onOpenPhoto: () -> Unit,
) {
    val palette = WispelTheme.palette

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.background.color, RoundedCornerShape(WDimens.radiusLarge))
            .padding(WDimens.spacingLg),
        verticalArrangement = Arrangement.spacedBy(WDimens.spacingMd),
    ) {
        Row(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = listOfNotNull(item.icon, item.title).joinToString(" "),
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = palette.text.color,
                )
                Text(
                    text = stringResource(
                        R.string.parent_approvals_submitted_by,
                        item.childName,
                    ),
                    color = palette.mutedText.color,
                )
                Text(
                    text = DATE_TIME_FORMATTER.format(
                        item.submittedAt.atZone(ZoneId.systemDefault()),
                    ),
                    style = MaterialTheme.typography.bodyMedium,
                    color = palette.mutedText.color,
                )
            }
            Text(
                text = pluralStringResource(
                    R.plurals.parent_approvals_points,
                    item.points,
                    item.points,
                ),
                style = MaterialTheme.typography.labelMedium,
                color = palette.mutedText.color,
            )
        }

        if (item.photoProcessing) {
            WBadge(text = stringResource(R.string.parent_approvals_photo_processing))
        }

        if (item.hasPhoto) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(PHOTO_TILE_HEIGHT)
                    .background(palette.accentSoft.color, RoundedCornerShape(WDimens.radiusLarge))
                    .clickable(onClick = onOpenPhoto),
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(WDimens.spacingSm),
                    modifier = Modifier.padding(WDimens.spacingLg),
                ) {
                    Icon(
                        imageVector = Icons.Filled.PhotoLibrary,
                        contentDescription = null,
                        tint = palette.accent.color,
                    )
                    Text(
                        text = stringResource(R.string.parent_photo_accessibility_label),
                        style = MaterialTheme.typography.bodyMedium,
                        color = palette.text.color,
                    )
                    if (item.photoReady) {
                        Text(
                            text = stringResource(R.string.parent_approvals_photo_ready),
                            style = MaterialTheme.typography.labelMedium,
                            color = palette.accent.color,
                        )
                    }
                    Text(
                        text = stringResource(R.string.parent_approvals_photo_safe),
                        style = MaterialTheme.typography.bodyMedium,
                        color = palette.mutedText.color,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        } else {
            WBadge(text = stringResource(R.string.parent_approvals_no_photo))
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(WDimens.spacingSm),
        ) {
            Checkbox(checked = isSelected, onCheckedChange = { onToggleSelection() })
            Text(
                text = stringResource(R.string.parent_approvals_toggle_bulk),
                color = palette.text.color,
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(WDimens.spacingSm)) {
            WPrimaryButton(
                text = stringResource(R.string.parent_approvals_approve),
                onClick = onApprove,
            )
            WSecondaryButton(
                text = stringResource(R.string.parent_approvals_redo),
                onClick = onRedo,
            )
        }
    }
}

@Composable
private fun BulkApprovalBar(
    validation: BulkApprovalValidation,
    isBusy: Boolean,
    selectionCount: Int,
    acknowledged: Boolean,
    onAcknowledgeChange: (Boolean) -> Unit,
    onApprove: () -> Unit,
) {
    val palette = WispelTheme.palette

    WPanel(modifier = Modifier.padding(WDimens.spacingXl)) {
        Text(
            text = stringResource(R.string.parent_bulk_title),
            style = MaterialTheme.typography.titleMedium,
            color = palette.text.color,
        )
        Text(
            text = stringResource(
                when (validation) {
                    BulkApprovalValidation.ALLOWED -> R.string.parent_bulk_allowed
                    BulkApprovalValidation.EMPTY -> R.string.parent_bulk_empty
                    BulkApprovalValidation.MIXED_CHILDREN -> R.string.parent_bulk_mixed
                    BulkApprovalValidation.PHOTO_ACKNOWLEDGEMENT_REQUIRED ->
                        R.string.parent_bulk_photo_ack
                },
            ),
            color = palette.mutedText.color,
        )

        if (validation == BulkApprovalValidation.PHOTO_ACKNOWLEDGEMENT_REQUIRED) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(WDimens.spacingSm),
            ) {
                Checkbox(checked = acknowledged, onCheckedChange = onAcknowledgeChange)
                Text(
                    text = stringResource(R.string.parent_bulk_photo_toggle),
                    color = palette.text.color,
                )
            }
        }

        WPrimaryButton(
            text = pluralStringResource(
                R.plurals.parent_bulk_button,
                selectionCount,
                selectionCount,
            ),
            onClick = onApprove,
            modifier = Modifier.fillMaxWidth(),
            enabled = validation == BulkApprovalValidation.ALLOWED && !isBusy,
        )
    }
}

/** Note sheet for "nog even kijken" — the note is required and must be positive. */
@Composable
fun ParentRedoSheet(
    item: ApprovalQueueItem,
    onDismiss: () -> Unit,
    onSubmit: (String) -> Unit,
) {
    val palette = WispelTheme.palette
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var note by remember { mutableStateOf("") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = palette.background.color,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(WDimens.spacingXl),
            verticalArrangement = Arrangement.spacedBy(WDimens.spacingLg),
        ) {
            Text(
                text = stringResource(R.string.parent_redo_title),
                style = MaterialTheme.typography.headlineSmall,
                color = palette.text.color,
            )
            Text(
                text = stringResource(R.string.parent_redo_note_prompt, item.childName),
                color = palette.mutedText.color,
            )
            OutlinedTextField(
                value = note,
                onValueChange = { note = it },
                placeholder = { Text(stringResource(R.string.parent_redo_note_placeholder)) },
                minLines = 3,
                modifier = Modifier.fillMaxWidth(),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(WDimens.spacingSm)) {
                WSecondaryButton(
                    text = stringResource(R.string.common_cancel),
                    onClick = onDismiss,
                )
                WPrimaryButton(
                    text = stringResource(R.string.parent_redo_submit),
                    onClick = { onSubmit(note.trim()) },
                    enabled = note.isNotBlank(),
                )
            }
        }
    }
}

private val PHOTO_TILE_HEIGHT = 220.dp
private val DATE_TIME_FORMATTER: DateTimeFormatter =
    DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT)
