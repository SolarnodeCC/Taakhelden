package nl.taakhelden.family.ui.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import nl.taakhelden.family.R
import nl.taakhelden.family.ui.components.WPrimaryButton
import nl.taakhelden.family.ui.components.WSecondaryButton
import nl.taakhelden.family.ui.components.WispelWordmark
import nl.taakhelden.family.ui.theme.WDimens
import nl.taakhelden.family.ui.theme.WispelTheme
import nl.taakhelden.family.ui.theme.color

/**
 * The family-app entry point.
 *
 * Deliberately in the parent register: an adult is the one installing the app and
 * choosing a path. Child pairing keeps a secondary button rather than flipping the whole
 * screen to kid-coral, which would promise a child surface that is not there yet.
 */
@Composable
fun WelcomeScreen(
    onParent: () -> Unit,
    onChild: () -> Unit,
) {
    val palette = WispelTheme.palette

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(palette.background.color)
            .safeDrawingPadding()
            .padding(WDimens.spacingXl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(WDimens.spacingXl),
    ) {
        Spacer(Modifier.weight(1f))

        WispelWordmark(modifier = Modifier.semantics { heading() })

        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(WDimens.spacingMd),
        ) {
            Text(
                text = stringResource(R.string.welcome_pitch),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = palette.text.color,
            )
            Text(
                text = stringResource(R.string.welcome_detail),
                style = MaterialTheme.typography.bodyLarge,
                color = palette.mutedText.color,
            )
        }

        WPrimaryButton(
            text = stringResource(R.string.welcome_parent),
            onClick = onParent,
            modifier = Modifier.fillMaxWidth(),
        )

        WSecondaryButton(
            text = stringResource(R.string.welcome_child),
            onClick = onChild,
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(Modifier.weight(1f))
    }
}
