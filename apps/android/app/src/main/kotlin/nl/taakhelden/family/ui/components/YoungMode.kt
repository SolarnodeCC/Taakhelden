package nl.taakhelden.family.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import nl.taakhelden.core.designsystem.YoungMode
import nl.taakhelden.family.R
import nl.taakhelden.family.platform.SpeechBus
import nl.taakhelden.family.ui.theme.WispelTheme
import nl.taakhelden.family.ui.theme.color

/**
 * Read-aloud button for young mode.
 *
 * Its own label is "Voorleesknop"; the sentence it will read is the accessibility hint, so
 * TalkBack does not read the whole sentence twice before the child even presses it.
 */
@Composable
fun YoungSpeakButton(
    text: String,
    speechBus: SpeechBus,
    modifier: Modifier = Modifier,
) {
    val palette = WispelTheme.palette
    val label = stringResource(R.string.child_young_speak)

    IconButton(
        onClick = { speechBus.speak(text) },
        modifier = modifier
            .size(YoungMode.MIN_TAP_TARGET_DP.dp)
            .background(palette.accent.color, CircleShape)
            .semantics { contentDescription = "$label: $text" },
    ) {
        Icon(
            imageVector = Icons.Filled.VolumeUp,
            contentDescription = null,
            tint = palette.onAccent.color,
        )
    }
}
