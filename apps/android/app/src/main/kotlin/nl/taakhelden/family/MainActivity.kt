package nl.taakhelden.family

import android.content.Intent
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.launch
import nl.taakhelden.family.push.PushEvent
import nl.taakhelden.family.push.WispelMessagingService
import nl.taakhelden.family.ui.AppRoot
import nl.taakhelden.family.ui.AppState

/**
 * The single activity.
 *
 * A [FragmentActivity] because `BiometricPrompt` requires one — the parental gate and the
 * child unlock both depend on it.
 */
class MainActivity : FragmentActivity() {

    private lateinit var appState: AppState

    /** Set in `onStop` so `onStart` can tell a rotation from a real return to the app. */
    private var wasChangingConfigurations = false

    private val environment: AppEnvironment
        get() = (application as WispelApplication).environment

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        appState = ViewModelProvider(this, AppState.Factory(environment))[AppState::class.java]

        handleIntent(intent)
        observePushEvents()

        setContent {
            val route by appState.route.collectAsState()
            LaunchedEffect(route) {
                // Re-registering on every route change is cheap (the service short-circuits
                // on an unchanged token) and catches the moment a session first exists.
                environment.pushService.registerIfNeeded()
            }
            AppRoot(appState = appState, activity = this)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    override fun onStart() {
        super.onStart()
        // A rotation also runs onStop/onStart. Treating that as "returned to the app"
        // would fire a sync and a push registration on every orientation change.
        if (!wasChangingConfigurations) {
            appState.handleAppForegrounded()
        }
        wasChangingConfigurations = false
    }

    override fun onStop() {
        // Leaving the app re-locks the child home — a phone handed to a sibling must land
        // on the unlock screen, not in someone else's day. A configuration change is not
        // leaving the app, though: locking there would kick a child out for rotating
        // their tablet.
        wasChangingConfigurations = isChangingConfigurations
        if (!wasChangingConfigurations) {
            appState.handleAppBackgrounded()
        }
        super.onStop()
    }

    private fun handleIntent(intent: Intent?) {
        val data = intent?.data ?: return
        if (environment.appleSignIn.handleRedirect(data)) {
            // Consume it so a rotation does not replay the sign-in redirect.
            intent.data = null
        }
    }

    private fun observePushEvents() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                WispelMessagingService.events.collect { event ->
                    when (event) {
                        is PushEvent.DeepLinkToApprovals -> appState.handlePushDeepLink()
                        is PushEvent.SilentRefresh -> appState.handleBackgroundPushRefresh()
                        is PushEvent.TokenRefreshed ->
                            environment.pushService.register(event.token)
                    }
                }
            }
        }
    }
}
