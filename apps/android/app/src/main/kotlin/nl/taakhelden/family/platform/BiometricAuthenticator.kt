package nl.taakhelden.family.platform

import android.os.Build
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.suspendCancellableCoroutine
import nl.taakhelden.core.i18n.UserMessage
import kotlin.coroutines.resume

class BiometricException(val userMessage: UserMessage) : Exception(userMessage.name)

/**
 * Device authentication for the parental gate and the child unlock screen.
 *
 * Two authenticator sets, deliberately different:
 *  - the **parental gate** accepts biometrics *or* the device credential, because it must
 *    stay reachable on a parent's phone that has no fingerprint enrolled;
 *  - the **child unlock** uses biometrics only, since the child's fallback is their own
 *    PIN, not the device passcode a parent set.
 */
class BiometricAuthenticator(private val activity: FragmentActivity) {

    private val manager = BiometricManager.from(activity)

    fun canEvaluateBiometrics(): Boolean =
        manager.canAuthenticate(BIOMETRIC_ONLY) == BiometricManager.BIOMETRIC_SUCCESS

    fun canEvaluateDeviceOwner(): Boolean =
        manager.canAuthenticate(deviceOwnerAuthenticators()) == BiometricManager.BIOMETRIC_SUCCESS

    suspend fun evaluateDeviceOwner(title: String, subtitle: String): Boolean =
        authenticate(title, subtitle, deviceOwnerAuthenticators(), negativeButtonText = null)

    suspend fun evaluateBiometrics(
        title: String,
        subtitle: String,
        negativeButtonText: String,
    ): Boolean = authenticate(title, subtitle, BIOMETRIC_ONLY, negativeButtonText)

    /**
     * Combining a biometric class with `DEVICE_CREDENTIAL` in `setAllowedAuthenticators`
     * is only supported from API 30; on 28–29 `PromptInfo.build()` rejects it outright.
     * Below 30 we therefore ask for biometrics and let the deprecated
     * `setDeviceCredentialAllowed` add the PIN/pattern fallback — otherwise the parental
     * gate would be unreachable on Android 8–10 for a parent with no fingerprint enrolled.
     */
    private fun deviceOwnerAuthenticators(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) DEVICE_OWNER else BIOMETRIC_ONLY

    private suspend fun authenticate(
        title: String,
        subtitle: String,
        authenticators: Int,
        negativeButtonText: String?,
    ): Boolean {
        val legacyDeviceCredential =
            negativeButtonText == null && Build.VERSION.SDK_INT < Build.VERSION_CODES.R

        if (!legacyDeviceCredential &&
            manager.canAuthenticate(authenticators) != BiometricManager.BIOMETRIC_SUCCESS
        ) {
            throw BiometricException(UserMessage.BIOMETRICS_UNAVAILABLE)
        }

        return suspendCancellableCoroutine { continuation ->
            val prompt = BiometricPrompt(
                activity,
                ContextCompat.getMainExecutor(activity),
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(
                        result: BiometricPrompt.AuthenticationResult,
                    ) {
                        if (continuation.isActive) continuation.resume(true)
                    }

                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        // Cancelling is a choice, not an error worth shouting about: the
                        // caller simply falls back to the PIN. Never log `errString` — on
                        // some devices it names the enrolled user.
                        if (continuation.isActive) continuation.resume(false)
                    }

                    override fun onAuthenticationFailed() {
                        // A single non-matching finger: the prompt stays up for a retry.
                    }
                },
            )

            val info = BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle(subtitle)
                .apply {
                    when {
                        negativeButtonText != null -> {
                            setAllowedAuthenticators(BIOMETRIC_ONLY)
                            setNegativeButtonText(negativeButtonText)
                        }

                        legacyDeviceCredential -> {
                            @Suppress("DEPRECATION")
                            setDeviceCredentialAllowed(true)
                        }

                        else -> setAllowedAuthenticators(DEVICE_OWNER)
                    }
                }
                .build()

            prompt.authenticate(info)
            continuation.invokeOnCancellation { runCatching { prompt.cancelAuthentication() } }
        }
    }

    private companion object {
        const val BIOMETRIC_ONLY = BiometricManager.Authenticators.BIOMETRIC_WEAK
        const val DEVICE_OWNER = BiometricManager.Authenticators.BIOMETRIC_WEAK or
            BiometricManager.Authenticators.DEVICE_CREDENTIAL
    }
}
