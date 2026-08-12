package nl.taakhelden.core.sync

import kotlinx.coroutines.delay
import nl.taakhelden.core.api.TaakHeldenApiClient
import nl.taakhelden.core.i18n.UserMessage

public class PhotoBonusException(public val userMessage: UserMessage) :
    Exception(userMessage.name)

/**
 * Uploads a task photo for the photo bonus.
 *
 * The four-step dance (intent → PUT → confirm → attach) exists because the photo is only
 * attachable once the Worker has stripped EXIF and marked it `ready`; attaching earlier
 * would surface an unprocessed image to a parent.
 */
public class PhotoBonusService(
    private val apiClient: TaakHeldenApiClient,
) {
    public suspend fun uploadTaskPhoto(instanceId: String, jpegData: ByteArray) {
        val intent = apiClient.createUploadIntent(
            instanceId = instanceId,
            contentType = CONTENT_TYPE,
            bytes = jpegData.size,
        )

        apiClient.uploadPhoto(intent.uploadUrl, jpegData, CONTENT_TYPE)
        apiClient.confirmPhoto(intent.photoId)

        repeat(MAX_POLL_ATTEMPTS) {
            val status = apiClient.fetchPhotoStatus(intent.photoId)
            when (status.status) {
                "ready" -> {
                    apiClient.attachPhoto(instanceId, intent.photoId)
                    return
                }

                "failed" -> throw PhotoBonusException(UserMessage.PHOTO_PROCESSING_FAILED)
            }
            delay(POLL_INTERVAL_MS)
        }

        throw PhotoBonusException(UserMessage.PHOTO_PROCESSING_TIMEOUT)
    }

    private companion object {
        const val CONTENT_TYPE = "image/jpeg"
        const val MAX_POLL_ATTEMPTS = 10
        const val POLL_INTERVAL_MS = 500L
    }
}
