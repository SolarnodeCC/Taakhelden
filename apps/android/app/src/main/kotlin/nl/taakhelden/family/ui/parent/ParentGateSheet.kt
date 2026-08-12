package nl.taakhelden.family.ui.parent

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.launch
import nl.taakhelden.core.gate.ParentGateUnlockMethod
import nl.taakhelden.family.R
import nl.taakhelden.family.platform.BiometricAuthenticator
import nl.taakhelden.family.ui.AppState
import nl.taakhelden.family.ui.components.WPanel
import nl.taakhelden.family.ui.components.WPrimaryButton
import nl.taakhelden.family.ui.components.WSecondaryButton
import nl.taakhelden.family.ui.components.WTextButton
import nl.taakhelden.family.ui.onboarding.AppleSignInButton
import nl.taakhelden.family.ui.theme.WDimens
import nl.taakhelden.family.ui.theme.WispelTheme
import nl.taakhelden.family.ui.theme.color

/**
 * The parental gate.
 *
 * Two ways through, and a child's PIN is deliberately not one of them: device
 * authentication (which a child does not have) or a parent account sign-in. The sheet says
 * so explicitly, because a child who understands why they cannot get in is less likely to
 * keep trying.
 */
@Composable
fun ParentGateSheet(
    appState: AppState,
    activity: FragmentActivity,
) {
    val palette = WispelTheme.palette
    val scope = rememberCoroutineScope()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val authenticator = remember(activity) { BiometricAuthenticator(activity) }

    var statusMessage by remember { mutableStateOf<String?>(null) }
    var isAuthenticating by remember { mutableStateOf(false) }
    var showAccountSignIn by remember { mutableStateOf(false) }

    val promptTitle = stringResource(R.string.parent_gate_la_title)
    val promptReason = stringResource(R.string.parent_gate_la_reason)
    val failedMessage = stringResource(R.string.parent_gate_la_failed)

    ModalBottomSheet(
        onDismissRequest = { appState.parentGate.closeGate() },
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
                text = stringResource(R.string.parent_gate_title),
                style = MaterialTheme.typography.headlineSmall,
                color = palette.text.color,
            )
            Text(
                text = stringResource(R.string.parent_gate_description),
                color = palette.mutedText.color,
            )

            WPanel {
                Text(
                    text = stringResource(R.string.parent_gate_behind),
                    style = MaterialTheme.typography.titleMedium,
                    color = palette.text.color,
                )
                Text(
                    text = stringResource(R.string.parent_gate_behind_detail),
                    color = palette.mutedText.color,
                )
            }

            Text(
                text = stringResource(R.string.parent_gate_child_pin_blocked),
                style = MaterialTheme.typography.labelMedium,
                color = palette.mutedText.color,
            )

            WPrimaryButton(
                text = stringResource(R.string.parent_gate_la_button),
                onClick = {
                    scope.launch {
                        isAuthenticating = true
                        val success = runCatching {
                            authenticator.evaluateDeviceOwner(promptTitle, promptReason)
                        }.getOrDefault(false)
                        isAuthenticating = false

                        if (success) {
                            statusMessage = null
                            appState.unlockParentMode(
                                ParentGateUnlockMethod.DEVICE_AUTHENTICATION,
                            )
                        } else {
                            statusMessage = failedMessage
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !isAuthenticating,
            )

            WSecondaryButton(
                text = stringResource(R.string.parent_gate_account_button),
                onClick = { showAccountSignIn = true },
                modifier = Modifier.fillMaxWidth(),
            )

            if (showAccountSignIn) {
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
                                    showAccountSignIn = false
                                    appState.unlockParentMode(
                                        ParentGateUnlockMethod.PARENT_ACCOUNT,
                                    )
                                }.onFailure { statusMessage = failedMessage }
                            }
                        },
                    )
                }
            }

            WTextButton(
                text = stringResource(R.string.parent_gate_cancel),
                onClick = { appState.parentGate.closeGate() },
            )

            statusMessage?.let {
                Text(text = it, color = palette.mutedText.color)
            }

            Text(
                text = stringResource(R.string.parent_gate_push_note),
                style = MaterialTheme.typography.bodyMedium,
                color = palette.mutedText.color,
            )
        }
    }
}
