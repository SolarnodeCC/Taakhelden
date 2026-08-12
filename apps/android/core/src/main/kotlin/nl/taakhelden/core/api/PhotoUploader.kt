package nl.taakhelden.core.api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

/**
 * PUTs photo bytes straight to the presigned R2 URL.
 *
 * This bypasses [OkHttpTransport] on purpose: the presigned URL is absolute, must not
 * carry our `Authorization` header, and sends raw JPEG rather than JSON. Never log the
 * URL — it is a capability (privacy rule 5).
 */
public class OkHttpPhotoUploader(
    private val client: OkHttpClient = OkHttpClient.Builder().build(),
) : PhotoUploading {

    override suspend fun upload(uploadUrl: String, data: ByteArray, contentType: String) {
        val url = uploadUrl.toHttpUrlOrNull() ?: throw HttpTransportException.InvalidUrl(uploadUrl)
        val request = Request.Builder()
            .url(url)
            .put(data.toRequestBody(contentType.toMediaType()))
            .header("Content-Type", contentType)
            .build()

        withContext(Dispatchers.IO) {
            try {
                client.newCall(request).execute().use { response ->
                    if (response.code >= 400) {
                        throw HttpTransportException.HttpStatus(response.code, null)
                    }
                }
            } catch (io: IOException) {
                throw HttpTransportException.Transport(io)
            }
        }
    }
}
