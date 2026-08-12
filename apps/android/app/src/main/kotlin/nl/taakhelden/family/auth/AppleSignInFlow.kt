package nl.taakhelden.family.auth

import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.security.SecureRandom
import android.util.Base64

/**
 * Sign in with Apple on Android.
 *
 * Android has no native Apple sign-in, so this drives Apple's *web* authorization flow in
 * a Custom Tab — the same flow Apple documents for non-Apple platforms. The identity token
 * that comes back is the same JWT the iOS app sends, and the Worker verifies it with the
 * exact same code path (`services/apple.ts`), so no API change was needed.
 *
 * The redirect leg cannot land straight in the app: Apple only redirects to an
 * `https://` URL registered against the Services ID, and it POSTs the result. So the
 * redirect target is a page on the Wispel web origin that bounces to this app's custom
 * scheme with the token in the fragment. Configure both in [AppleSignInConfig].
 *
 * A [state] value is generated per attempt and checked on return, so a redirect this app
 * did not initiate is rejected.
 */
data class AppleSignInConfig(
    /** Apple *Services ID* (not the iOS bundle id), e.g. `cc.wispel.signin`. */
    val clientId: String,
    /** Registered `https` redirect URI that bounces back to [appRedirectScheme]. */
    val redirectUri: String,
    /** Custom scheme this app registers in its manifest for the return leg. */
    val appRedirectScheme: String,
) {
    val isConfigured: Boolean
        get() = clientId.isNotBlank() && redirectUri.isNotBlank()
}

data class AppleIdentity(
    val identityToken: String,
    val familyName: String?,
    val displayName: String?,
)

sealed interface AppleSignInResult {
    data object Idle : AppleSignInResult
    data object InProgress : AppleSignInResult
    data class Success(val identity: AppleIdentity) : AppleSignInResult
    data object Failed : AppleSignInResult
    data object NotConfigured : AppleSignInResult
}

class AppleSignInFlow(private val config: AppleSignInConfig) {

    private val _result = MutableStateFlow<AppleSignInResult>(AppleSignInResult.Idle)
    val result: StateFlow<AppleSignInResult> = _result.asStateFlow()

    private var pendingState: String? = null

    val isConfigured: Boolean get() = config.isConfigured

    fun start(context: Context) {
        if (!config.isConfigured) {
            _result.value = AppleSignInResult.NotConfigured
            return
        }

        val state = randomState().also { pendingState = it }
        val authorizeUrl = Uri.parse(AUTHORIZE_ENDPOINT)
            .buildUpon()
            .appendQueryParameter("client_id", config.clientId)
            .appendQueryParameter("redirect_uri", config.redirectUri)
            .appendQueryParameter("response_type", "code id_token")
            // Apple requires form_post whenever `name` or `email` scope is requested.
            .appendQueryParameter("response_mode", "form_post")
            .appendQueryParameter("scope", "name email")
            .appendQueryParameter("state", state)
            .build()

        _result.value = AppleSignInResult.InProgress
        CustomTabsIntent.Builder()
            .setShowTitle(true)
            .build()
            .launchUrl(context, authorizeUrl)
    }

    /**
     * Handles the return leg. Returns true when [uri] was ours, so the caller knows
     * whether to consume the intent.
     */
    fun handleRedirect(uri: Uri): Boolean {
        if (uri.scheme != config.appRedirectScheme) return false

        // The bounce page puts the result in the fragment so it never lands in a browser
        // history entry or a server log the way a query string would.
        val parameters = parseFragment(uri)
        val returnedState = parameters["state"]
        if (returnedState == null || returnedState != pendingState) {
            pendingState = null
            _result.value = AppleSignInResult.Failed
            return true
        }
        pendingState = null

        val identityToken = parameters["id_token"]
        if (identityToken.isNullOrBlank()) {
            _result.value = AppleSignInResult.Failed
            return true
        }

        // Apple only sends the user's name on the very first authorization; afterwards
        // these are absent and the Worker keeps the name it already stored.
        _result.value = AppleSignInResult.Success(
            AppleIdentity(
                identityToken = identityToken,
                familyName = parameters["family_name"]?.takeIf { it.isNotBlank() },
                displayName = parameters["display_name"]?.takeIf { it.isNotBlank() },
            ),
        )
        return true
    }

    fun reset() {
        _result.value = AppleSignInResult.Idle
    }

    private fun parseFragment(uri: Uri): Map<String, String> {
        val fragment = uri.fragment ?: uri.query ?: return emptyMap()
        return fragment.split('&')
            .mapNotNull { pair ->
                val index = pair.indexOf('=')
                if (index <= 0) {
                    null
                } else {
                    Uri.decode(pair.substring(0, index)) to Uri.decode(pair.substring(index + 1))
                }
            }
            .toMap()
    }

    private fun randomState(): String {
        val bytes = ByteArray(STATE_BYTES).also(SecureRandom()::nextBytes)
        return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
    }

    private companion object {
        const val AUTHORIZE_ENDPOINT = "https://appleid.apple.com/auth/authorize"
        const val STATE_BYTES = 24
    }
}
