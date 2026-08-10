package nl.taakhelden.family.ui.parent

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Tab
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Text
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
import nl.taakhelden.core.parent.ApprovalQueueItem
import nl.taakhelden.core.parent.ParentSurface
import nl.taakhelden.core.parent.ParentSyncState
import nl.taakhelden.core.parent.ParentSyncTrigger
import nl.taakhelden.core.realtime.FamilyRoomConnectionState
import nl.taakhelden.family.R
import nl.taakhelden.family.ui.AppState
import nl.taakhelden.family.ui.components.WBadge
import nl.taakhelden.family.ui.components.WStatusPill
import nl.taakhelden.family.ui.components.WTextButton
import nl.taakhelden.family.ui.text
import nl.taakhelden.family.ui.theme.WDimens
import nl.taakhelden.family.ui.theme.WispelTheme
import nl.taakhelden.family.ui.theme.color
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

private val PARENT_SURFACES = listOf(
    ParentSurface.VANDAAG to R.string.parent_surface_vandaag,
    ParentSurface.GOEDKEUREN to R.string.parent_surface_goedkeuren,
    ParentSurface.TAKEN to R.string.parent_surface_taken,
    ParentSurface.BELONINGEN to R.string.parent_surface_beloningen,
    ParentSurface.INSTELLINGEN to R.string.parent_surface_instellingen,
)

/**
 * Parent mode: a full-screen surface layered over the child app, behind the gate.
 *
 * It owns the realtime session for as long as it is on screen, so approvals a co-parent
 * makes on another device disappear from this queue without a manual refresh.
 */
@Composable
fun ParentModeScreen(appState: AppState) {
    val palette = WispelTheme.palette
    val scope = rememberCoroutineScope()
    val store = appState.parentMode
    val state by store.state.collectAsState()
    val syncState by store.syncCoordinator.state.collectAsState()

    var redoTarget by remember { mutableStateOf<ApprovalQueueItem?>(null) }
    var showDeleteConfirmation by remember { mutableStateOf(false) }
    var showAppleReauth by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { store.beginSession() }

    BackHandler { appState.closeParentMode() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(palette.background.color)
            .safeDrawingPadding(),
    ) {
        ParentHeader(
            pendingCount = state.snapshot?.pendingApprovalCount ?: 0,
            connectionState = state.connectionState,
            syncState = syncState,
            loadFailure = state.loadFailure,
            isLoading = state.isLoading,
            onBack = appState::closeParentMode,
            onRefresh = {
                scope.launch { store.refresh(ParentSyncTrigger.MANUAL_REFRESH) }
            },
        )

        val selectedIndex = PARENT_SURFACES.indexOfFirst { it.first == state.activeSurface }
        ScrollableTabRow(
            selectedTabIndex = selectedIndex.coerceAtLeast(0),
            containerColor = palette.background.color,
            contentColor = palette.accent.color,
            edgePadding = WDimens.spacingXl,
        ) {
            PARENT_SURFACES.forEach { (surface, labelRes) ->
                Tab(
                    selected = state.activeSurface == surface,
                    onClick = { store.setActiveSurface(surface) },
                    text = { Text(stringResource(labelRes)) },
                )
            }
        }

        Box(modifier = Modifier.fillMaxSize()) {
            when (state.activeSurface) {
                ParentSurface.VANDAAG -> ParentTodayTab(
                    snapshot = state.snapshot,
                    isLoading = state.isLoading,
                )

                ParentSurface.GOEDKEUREN -> ParentApprovalsTab(
                    store = store,
                    state = state,
                    onRedo = { redoTarget = it },
                )

                ParentSurface.TAKEN -> ParentTasksTab(store = store, state = state)

                ParentSurface.BELONINGEN -> ParentRewardsTab(store = store, state = state)

                ParentSurface.INSTELLINGEN -> ParentSettingsTab(
                    appState = appState,
                    store = store,
                    state = state,
                    onRequestDelete = { showDeleteConfirmation = true },
                )
            }
        }
    }

    redoTarget?.let { item ->
        ParentRedoSheet(
            item = item,
            onDismiss = { redoTarget = null },
            onSubmit = { note ->
                scope.launch {
                    store.sendRedo(item, note)
                    redoTarget = null
                }
            },
        )
    }

    state.fullscreenPhoto?.let { asset ->
        ParentPhotoViewer(asset = asset, onClose = store::closeFullscreenPhoto)
    }

    if (showDeleteConfirmation) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirmation = false },
            title = { Text(stringResource(R.string.parent_settings_delete_confirm_title)) },
            text = { Text(stringResource(R.string.parent_settings_delete_confirm_message)) },
            confirmButton = {
                WTextButton(
                    text = stringResource(R.string.parent_settings_delete_confirm_button),
                    onClick = {
                        showDeleteConfirmation = false
                        showAppleReauth = true
                    },
                )
            },
            dismissButton = {
                WTextButton(
                    text = stringResource(R.string.common_cancel),
                    onClick = { showDeleteConfirmation = false },
                )
            },
        )
    }

    if (showAppleReauth) {
        // Deleting a family is irreversible, so it demands a *fresh* Apple identity token
        // rather than the parent session already on this device.
        ParentDeleteConfirmSheet(
            appState = appState,
            onDismiss = { showAppleReauth = false },
            onToken = { token ->
                scope.launch {
                    val deleted = store.requestDeleteAccount(token)
                    showAppleReauth = false
                    if (deleted) {
                        appState.closeParentMode()
                        appState.returnToWelcome()
                    }
                }
            },
        )
    }
}

@Composable
private fun ParentHeader(
    pendingCount: Int,
    connectionState: FamilyRoomConnectionState,
    syncState: ParentSyncState,
    loadFailure: nl.taakhelden.core.i18n.UserMessage?,
    isLoading: Boolean,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
) {
    val palette = WispelTheme.palette

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = WDimens.spacingXl, vertical = WDimens.spacingLg),
        verticalArrangement = Arrangement.spacedBy(WDimens.spacingSm),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            WTextButton(text = stringResource(R.string.parent_mode_back), onClick = onBack)
            WTextButton(
                text = stringResource(R.string.parent_mode_refresh),
                onClick = onRefresh,
                enabled = !isLoading,
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = stringResource(R.string.parent_mode_title),
                    style = MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.Bold,
                    color = palette.text.color,
                )
                Text(
                    text = stringResource(R.string.parent_mode_subtitle),
                    color = palette.mutedText.color,
                )
            }
            WBadge(text = stringResource(R.string.parent_mode_pending, pendingCount))
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(WDimens.spacingMd),
        ) {
            WStatusPill(
                title = stringResource(R.string.parent_sync_live),
                detail = connectionLabel(connectionState),
            )
            WStatusPill(
                title = stringResource(R.string.parent_sync_sync),
                detail = syncLabel(syncState),
            )
        }

        loadFailure?.let {
            Text(
                text = it.text(),
                style = MaterialTheme.typography.bodyMedium,
                color = palette.mutedText.color,
            )
        }
    }
}

@Composable
private fun connectionLabel(state: FamilyRoomConnectionState): String = when (state) {
    is FamilyRoomConnectionState.Disconnected -> stringResource(R.string.parent_sync_disconnected)
    is FamilyRoomConnectionState.Connecting -> stringResource(R.string.parent_sync_connecting)
    is FamilyRoomConnectionState.Connected -> stringResource(R.string.parent_sync_connected)
    is FamilyRoomConnectionState.WaitingToReconnect ->
        stringResource(R.string.parent_sync_reconnect, state.seconds)
}

@Composable
private fun syncLabel(state: ParentSyncState): String = when (state) {
    is ParentSyncState.Idle -> stringResource(R.string.parent_sync_idle)
    is ParentSyncState.Syncing -> stringResource(R.string.parent_sync_busy)
    is ParentSyncState.Synced -> stringResource(
        R.string.parent_sync_updated,
        TIME_FORMATTER.format(state.at.atZone(ZoneId.systemDefault())),
    )

    is ParentSyncState.Failed -> stringResource(R.string.parent_sync_retry)
}

private val TIME_FORMATTER: DateTimeFormatter =
    DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT)
