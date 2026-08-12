package nl.taakhelden.family.ui.parent

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Photo
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import nl.taakhelden.core.parent.ParentPhotoAsset
import nl.taakhelden.family.R
import nl.taakhelden.family.ui.components.WPanel
import nl.taakhelden.family.ui.components.WSecondaryButton
import nl.taakhelden.family.ui.theme.WDimens
import nl.taakhelden.family.ui.theme.WispelTheme
import nl.taakhelden.family.ui.theme.color

/**
 * Fullscreen photo review.
 *
 * Deliberately shows nothing but the image: no EXIF, no capture time, no location, no
 * device. The card below says so out loud, because a parent judging a photo should know
 * what the app is and is not telling them about it.
 */
@Composable
fun ParentPhotoViewer(
    asset: ParentPhotoAsset,
    onClose: () -> Unit,
) {
    val palette = WispelTheme.palette
    var scale by remember { mutableFloatStateOf(1f) }
    val photoLabel = stringResource(R.string.parent_photo_accessibility_label)

    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(palette.background.color)
                .safeDrawingPadding()
                .padding(WDimens.spacingXl),
            verticalArrangement = Arrangement.spacedBy(WDimens.spacingLg),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center,
            ) {
                if (asset.previewUrl != null) {
                    AsyncImage(
                        model = asset.previewUrl,
                        contentDescription = photoLabel,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier
                            .fillMaxSize()
                            .graphicsLayer(scaleX = scale, scaleY = scale)
                            .pointerInput(Unit) {
                                detectTransformGestures { _, _, zoom, _ ->
                                    // Pinch to inspect detail; capped so the image cannot
                                    // be zoomed into an unrecognisable smear.
                                    scale = (scale * zoom).coerceIn(1f, 4f)
                                }
                            },
                    )
                } else {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(WDimens.spacingSm),
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Photo,
                            contentDescription = null,
                            tint = palette.accent.color,
                        )
                        Text(text = photoLabel, color = palette.text.color)
                    }
                }
            }

            WPanel {
                Text(
                    text = stringResource(R.string.parent_photo_safe_title),
                    style = MaterialTheme.typography.titleMedium,
                    color = palette.text.color,
                )
                Text(
                    text = stringResource(R.string.parent_photo_safe_detail),
                    color = palette.mutedText.color,
                )
            }

            WSecondaryButton(
                text = stringResource(R.string.common_close),
                onClick = onClose,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
