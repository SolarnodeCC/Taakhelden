package nl.taakhelden.family.ui.onboarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import nl.taakhelden.family.R
import nl.taakhelden.family.auth.AppleIdentity
import nl.taakhelden.family.auth.AppleSignInFlow
import nl.taakhelden.family.auth.AppleSignInResult
import nl.taakhelden.family.ui.components.WPrimaryButton
import nl.taakhelden.family.ui.theme.WDimens
import nl.taakhelden.family.ui.theme.WispelTheme
import nl.taakhelden.family.ui.theme.color

/**
 * Sign in with Apple, driven through Apple's web flow (see [AppleSignInFlow]).
 *
 * When the Apple Services ID has not been configured for this build, the button explains
 * that instead of opening a broken Apple page — a dead-end web view is a worse experience
 * than an honest message.
 */
@Composable
fun AppleSignInButton(
    flow: AppleSignInFlow,
    onIdentity: (AppleIdentity) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val palette = WispelTheme.palette
    val result by flow.result.collectAsState()

    LaunchedEffect(result) {
        val success = result as? AppleSignInResult.Success ?: return@LaunchedEffect
        onIdentity(success.identity)
        flow.reset()
    }

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(WDimens.spacingSm),
    ) {
        WPrimaryButton(
            text = stringResource(R.string.sign_in_with_apple),
            onClick = { flow.start(context) },
            modifier = Modifier.fillMaxWidth(),
            enabled = flow.isConfigured && result !is AppleSignInResult.InProgress,
        )

        when (result) {
            is AppleSignInResult.Failed, is AppleSignInResult.NotConfigured -> Text(
                text = stringResource(R.string.error_apple_sign_in_failed),
                style = MaterialTheme.typography.bodyMedium,
                color = palette.mutedText.color,
            )

            else -> Unit
        }
    }
}
