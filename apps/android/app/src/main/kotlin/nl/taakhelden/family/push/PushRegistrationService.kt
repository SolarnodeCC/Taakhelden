package nl.taakhelden.family.push

import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.suspendCancellableCoroutine
import nl.taakhelden.core.api.TaakHeldenApiClient
import nl.taakhelden.family.BuildConfig
import kotlin.coroutines.resume

/**
 * Registers this device's FCM token with the Worker.
 *
 * Push is optional by design: without a `google-services.json` (or with the user
 * declining notifications) every call here is a quiet no-op and the app keeps working.
 * Never log the token — it identifies the device.
 */
class PushRegistrationService(
    private val apiClient: TaakHeldenApiClient,
) {
    @Volatile
    private var registeredToken: String? = null

    val currentToken: String? get() = registeredToken

    /** Outcome of a registration attempt, so a caller can retry rather than guess. */
    enum class Result { REGISTERED, ALREADY_REGISTERED, UNAVAILABLE, FAILED }

    suspend fun registerIfNeeded(): Result {
        if (!BuildConfig.FIREBASE_CONFIGURED) return Result.UNAVAILABLE
        val token = fetchToken() ?: return Result.UNAVAILABLE
        return register(token)
    }

    /**
     * Registration is best-effort by design: push is an optional extra, and a family
     * whose token cannot be stored must still be able to check off tasks. The failure is
     * reported back rather than thrown, so the caller decides whether to retry — it is
     * never allowed to break the screen the user is on.
     */
    suspend fun register(token: String): Result {
        if (token == registeredToken) return Result.ALREADY_REGISTERED
        return runCatching { apiClient.registerDevice(token) }
            .fold(
                onSuccess = {
                    registeredToken = token
                    Result.REGISTERED
                },
                onFailure = { Result.FAILED },
            )
    }

    /**
     * Detaches this token from the **departing** user only. On a shared tablet the other
     * profiles' registrations stay intact.
     */
    suspend fun deregisterCurrentUser() {
        val token = registeredToken ?: return
        runCatching { apiClient.deregisterDevice(token) }
        registeredToken = null
    }

    private suspend fun fetchToken(): String? = suspendCancellableCoroutine { continuation ->
        runCatching {
            FirebaseMessaging.getInstance().token
                .addOnCompleteListener { task ->
                    if (!continuation.isActive) return@addOnCompleteListener
                    continuation.resume(task.result?.takeIf { task.isSuccessful })
                }
        }.onFailure {
            if (continuation.isActive) continuation.resume(null)
        }
    }
}
