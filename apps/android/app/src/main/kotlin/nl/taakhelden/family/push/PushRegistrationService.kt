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

    suspend fun registerIfNeeded() {
        if (!BuildConfig.FIREBASE_CONFIGURED) return
        val token = fetchToken() ?: return
        register(token)
    }

    suspend fun register(token: String) {
        if (token == registeredToken) return
        runCatching { apiClient.registerDevice(token) }
            .onSuccess { registeredToken = token }
        // A failure is intentionally swallowed: a family whose push registration fails
        // must still be able to check off tasks.
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
