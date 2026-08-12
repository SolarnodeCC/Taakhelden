package nl.taakhelden.family.ui.child

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import nl.taakhelden.family.R
import nl.taakhelden.family.platform.ImageCompression
import nl.taakhelden.family.ui.components.WSecondaryButton
import nl.taakhelden.family.ui.theme.WDimens
import java.io.File

/**
 * Camera and gallery entry points for the photo bonus.
 *
 * Neither path asks for a permission. The gallery uses the system photo picker, which
 * grants access to the single chosen image only. The camera writes to our own cache
 * through a `FileProvider` — `TakePicture` rather than `TakePicturePreview`, because the
 * latter hands back a small thumbnail and a parent has to be able to actually see whether
 * the room got tidied.
 */
@Composable
fun PhotoBonusPicker(
    onPhotoReady: (ByteArray) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var pendingCameraFile by remember { mutableStateOf<File?>(null) }

    val cameraLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicture(),
    ) { saved ->
        val file = pendingCameraFile
        pendingCameraFile = null
        if (!saved || file == null) {
            file?.delete()
            return@rememberLauncherForActivityResult
        }
        scope.launch {
            val jpeg = withContext(Dispatchers.IO) {
                try {
                    ImageCompression.jpegFromUri(context, Uri.fromFile(file))
                } finally {
                    // The capture is transient: once compressed it must not linger in the
                    // cache where a later gallery scan or backup could pick it up.
                    file.delete()
                }
            }
            if (jpeg != null) onPhotoReady(jpeg)
        }
    }

    val galleryLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            // Decoding and re-encoding a full-size photo blocks long enough to drop
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
            onClick = {
                val target = createTaskPhotoFile(context) ?: return@WSecondaryButton
                pendingCameraFile = target
                cameraLauncher.launch(taskPhotoUri(context, target))
            },
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

private fun createTaskPhotoFile(context: Context): File? = runCatching {
    val directory = File(context.cacheDir, "task-photos").apply { mkdirs() }
    File.createTempFile("capture-", ".jpg", directory)
}.getOrNull()

private fun taskPhotoUri(context: Context, file: File): Uri = FileProvider.getUriForFile(
    context,
    "${context.packageName}.fileprovider",
    file,
)
