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
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import kotlinx.coroutines.launch
import nl.taakhelden.core.child.ParentFamilyGoalSettingsStore
import nl.taakhelden.core.parent.ExportReceiptMessage
import nl.taakhelden.core.parent.ParentModeState
import nl.taakhelden.core.parent.ParentModeStore
import nl.taakhelden.core.parent.ParentSyncTrigger
import nl.taakhelden.family.R
import nl.taakhelden.family.ui.AppState
import nl.taakhelden.family.ui.components.WPanel
import nl.taakhelden.family.ui.components.WPrimaryButton
import nl.taakhelden.family.ui.components.WSecondaryButton
import nl.taakhelden.family.ui.familygoal.ParentFamilyGoalSettings
import nl.taakhelden.family.ui.onboarding.AppleSignInButton
import nl.taakhelden.family.ui.text
import nl.taakhelden.family.ui.theme.WDimens
import nl.taakhelden.family.ui.theme.WispelTheme
import nl.taakhelden.family.ui.theme.color

/**
 * Settings behind the gate: reward sound, the shared family goal, and the privacy actions
 * (export and delete). All of it is deliberately unreachable from child mode.
 */
@Composable
fun ParentSettingsTab(
    appState: AppState,
    store: ParentModeStore,
    state: ParentModeState,
    onRequestDelete: () -> Unit,
) {
    val palette = WispelTheme.palette
    val scope = rememberCoroutineScope()
    val defaultGoalTitle = stringResource(R.string.goal_parent_default_title)

    val familyGoalStore = remember(defaultGoalTitle) {
        ParentFamilyGoalSettingsStore(appState.environment.apiClient, defaultGoalTitle)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(WDimens.spacingXl),
        verticalArrangement = Arrangement.spacedBy(WDimens.spacingLg),
    ) {
        if (state.needsParentAccount) {
            WPanel {
                Text(
                    text = stringResource(R.string.parent_gate_account_title),
                    style = MaterialTheme.typography.titleMedium,
                    color = palette.text.color,
                )
                Text(
                    text = stringResource(R.string.parent_gate_account_detail),
                    color = palette.mutedText.color,
                )
                AppleSignInButton(
                    flow = appState.environment.appleSignIn,
                    onIdentity = { identity ->
                        scope.launch {
                            runCatching {
                                appState.environment.apiClient.signInWithApple(
                                    identityToken = identity.identityToken,
                                    familyName = identity.familyName,
                                    displayName = identity.displayName,
                                )
                            }.onSuccess { session ->
                                appState.authStore.storeParentSession(session)
                                store.refresh(ParentSyncTrigger.MANUAL_REFRESH)
                            }
                        }
                    },
                )
            }
        }

        WPanel {
            Text(
                text = stringResource(R.string.parent_settings_sound_title),
                style = MaterialTheme.typography.titleMedium,
                color = palette.text.color,
            )
            Text(
                text = stringResource(R.string.parent_settings_sound_detail),
                color = palette.mutedText.color,
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(R.string.parent_settings_sound_toggle),
                    color = palette.text.color,
                )
                Switch(
                    checked = state.snapshot?.settings?.soundEnabled ?: true,
                    onCheckedChange = { enabled ->
                        scope.launch { store.updateSoundPreference(enabled) }
                    },
                )
            }
        }

        ParentFamilyGoalSettings(store = familyGoalStore)

        WPanel {
            Text(
                text = stringResource(R.string.parent_settings_privacy_title),
                style = MaterialTheme.typography.titleMedium,
                color = palette.text.color,
            )
            Text(
                text = stringResource(R.string.parent_settings_privacy_detail),
                color = palette.mutedText.color,
            )

            WPrimaryButton(
                text = stringResource(R.string.parent_settings_export),
                onClick = { scope.launch { store.requestExport() } },
                modifier = Modifier.fillMaxWidth(),
            )
            WSecondaryButton(
                text = stringResource(R.string.parent_settings_delete),
                onClick = onRequestDelete,
                modifier = Modifier.fillMaxWidth(),
            )

            state.exportReceipt?.let { receipt ->
                Text(
                    text = when (receipt.message) {
                        ExportReceiptMessage.READY -> stringResource(
                            R.string.parent_settings_export_ready,
                            receipt.downloadUrl.orEmpty(),
                        )

                        ExportReceiptMessage.PENDING ->
                            stringResource(R.string.parent_settings_export_pending)

                        ExportReceiptMessage.FAILED ->
                            stringResource(R.string.parent_settings_export_failed)
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = palette.mutedText.color,
                )
            }

            if (state.deletionSucceeded) {
                Text(
                    text = stringResource(R.string.parent_settings_delete_success),
                    style = MaterialTheme.typography.bodyMedium,
                    color = palette.mutedText.color,
                )
            }
            state.deletionFailure?.let {
                Text(
                    text = it.text(),
                    style = MaterialTheme.typography.bodyMedium,
                    color = palette.mutedText.color,
                )
            }
        }
    }
}

/** Re-authentication sheet shown before an irreversible account delete. */
@Composable
fun ParentDeleteConfirmSheet(
    appState: AppState,
    onDismiss: () -> Unit,
    onToken: (String) -> Unit,
) {
    val palette = WispelTheme.palette
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

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
                text = stringResource(R.string.parent_settings_delete_siwa_title),
                style = MaterialTheme.typography.headlineSmall,
                color = palette.text.color,
            )
            Text(
                text = stringResource(R.string.parent_settings_delete_siwa_detail),
                color = palette.mutedText.color,
            )
            AppleSignInButton(
                flow = appState.environment.appleSignIn,
                onIdentity = { identity -> onToken(identity.identityToken) },
            )
            WSecondaryButton(
                text = stringResource(R.string.common_cancel),
                onClick = onDismiss,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
