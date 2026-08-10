package nl.taakhelden.family.platform

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import java.io.ByteArrayOutputStream
import kotlin.math.sqrt

/**
 * Prepares a task photo for upload: roughly 2 megapixels of JPEG.
 *
 * Two things matter here beyond size. The bitmap is re-encoded from raw pixels, which
 * drops the original EXIF block on the device — the Worker strips EXIF again server-side,
 * but a photo that never carried location off the phone is strictly better. And because
 * re-encoding also drops the orientation tag, the rotation is baked into the pixels first,
 * or a parent would review a sideways photo.
 */
object ImageCompression {

    private const val MAX_PIXEL_AREA = 2_000_000
    private const val JPEG_QUALITY = 82

    fun jpegFromUri(context: Context, uri: Uri): ByteArray? {
        val resolver = context.contentResolver

        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

        val decodeOptions = BitmapFactory.Options().apply {
            inSampleSize = sampleSizeFor(bounds.outWidth, bounds.outHeight)
        }
        val decoded = resolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, decodeOptions)
        } ?: return null

        val orientation = resolver.openInputStream(uri)?.use { stream ->
            runCatching {
                ExifInterface(stream).getAttributeInt(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_NORMAL,
                )
            }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)
        } ?: ExifInterface.ORIENTATION_NORMAL

        val upright = applyOrientation(decoded, orientation)
        return jpegFromBitmap(upright)
    }

    fun jpegFromBitmap(bitmap: Bitmap): ByteArray {
        val resized = resize(bitmap)
        return ByteArrayOutputStream().use { output ->
            resized.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, output)
            output.toByteArray()
        }
    }

    /** Power-of-two downscale during decode, so a 12 MP photo never fully hits memory. */
    private fun sampleSizeFor(width: Int, height: Int): Int {
        var sampleSize = 1
        while ((width / sampleSize).toLong() * (height / sampleSize) > MAX_PIXEL_AREA * 2L) {
            sampleSize *= 2
        }
        return sampleSize
    }

    private fun resize(bitmap: Bitmap): Bitmap {
        val area = bitmap.width.toLong() * bitmap.height.toLong()
        if (area <= MAX_PIXEL_AREA || area == 0L) return bitmap

        val scale = sqrt(MAX_PIXEL_AREA.toDouble() / area.toDouble())
        val width = (bitmap.width * scale).toInt().coerceAtLeast(1)
        val height = (bitmap.height * scale).toInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(bitmap, width, height, true)
    }

    private fun applyOrientation(bitmap: Bitmap, orientation: Int): Bitmap {
        val matrix = Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.postScale(-1f, 1f)
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.postScale(1f, -1f)
            else -> return bitmap
        }
        return runCatching {
            Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        }.getOrDefault(bitmap)
    }
}
