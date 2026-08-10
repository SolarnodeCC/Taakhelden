package nl.taakhelden.family.ui.child

import android.graphics.Bitmap
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import nl.taakhelden.family.R
import nl.taakhelden.family.platform.ImageCompression
import nl.taakhelden.family.ui.components.WSecondaryButton
import nl.taakhelden.family.ui.theme.WDimens

/**
 * Camera and gallery entry points for the photo bonus.
 *
 * Uses the photo picker rather than a storage permission: it grants access to the single
 * chosen image only, which is exactly what this feature needs and nothing more.
 * `TakePicturePreview` likewise avoids a file provider and any permission prompt.
 */
@Composable
fun PhotoBonusPicker(
    onPhotoReady: (ByteArray) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val cameraLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicturePreview(),
    ) { bitmap: Bitmap? ->
        if (bitmap == null) return@rememberLauncherForActivityResult
        scope.launch {
            val jpeg = withContext(Dispatchers.Default) {
                ImageCompression.jpegFromBitmap(bitmap)
            }
            onPhotoReady(jpeg)
        }
    }

    val galleryLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            // Decoding and re-encoding a full-size photo blocks for long enough to drop
            // frames, so it stays off the UI thread.
            val jpeg = withContext(Dispatchers.IO) {
                ImageCompression.jpegFromUri(context, uri)
            }
            if (jpeg != null) onPhotoReady(jpeg)
        }
    }

    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(WDimens.spacingSm),
    ) {
        WSecondaryButton(
            text = stringResource(R.string.child_photo_take),
            onClick = { cameraLauncher.launch(null) },
        )
        WSecondaryButton(
            text = stringResource(R.string.child_photo_pick),
            onClick = {
                galleryLauncher.launch(
                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
                )
            },
        )
    }
}
