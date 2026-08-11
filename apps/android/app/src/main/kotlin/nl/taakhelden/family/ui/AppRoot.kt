package nl.taakhelden.family.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.fragment.app.FragmentActivity
import nl.taakhelden.core.auth.ChildAgeBand
import nl.taakhelden.family.ui.child.ChildShell
import nl.taakhelden.family.ui.onboarding.ChildPairingScreen
import nl.taakhelden.family.ui.onboarding.ChildUnlockScreen
import nl.taakhelden.family.ui.onboarding.ParentOnboardingScreen
import nl.taakhelden.family.ui.onboarding.WelcomeScreen
import nl.taakhelden.family.ui.parent.ParentGateSheet
import nl.taakhelden.family.ui.parent.ParentModeScreen
import nl.taakhelden.family.ui.theme.WRegister
import nl.taakhelden.family.ui.theme.WispelTheme

/**
 * Routes between the five top-level destinations and layers the parental gate over them.
 *
 * The register is chosen here, once per destination: onboarding and parent mode are the
 * calm parent register, the child surfaces are warm (or muted for a teen). No component
 * below this point picks its own palette.
 */
@Composable
fun AppRoot(appState: AppState, activity: FragmentActivity) {
    val route by appState.route.collectAsState()
    val childSession by appState.authStore.childSessionFlow.collectAsState()
    val isChallengePresented by appState.parentGate.isChallengePresented.collectAsState()
    val isParentModePresented by appState.parentGate.isParentModePresented.collectAsState()

    val childRegister = when (childSession?.ageBand) {
        ChildAgeBand.TEEN -> WRegister.TEEN
        else -> WRegister.KID
    }
    val isYoung = childSession?.ageBand == ChildAgeBand.YOUNG

    // An explicit Box rather than bare siblings: parent mode is an opaque full-screen
    // layer over whatever route is underneath, and that stacking should not depend on
    // the implicit behaviour of the composition root.
    Box(modifier = Modifier.fillMaxSize()) {
        when (route) {
            AppRoute.WELCOME -> WispelTheme(WRegister.PARENT) {
                WelcomeScreen(
                    onParent = appState::openParentOnboarding,
                    onChild = appState::openChildPairing,
                )
            }

            AppRoute.PARENT_ONBOARDING -> WispelTheme(WRegister.PARENT) {
                ParentOnboardingScreen(
                    appState = appState,
                    onBack = appState::navigateToWelcome,
                    onGoToPairing = appState::openChildPairing,
                )
            }

            AppRoute.CHILD_PAIRING -> WispelTheme(WRegister.KID) {
                ChildPairingScreen(
                    appState = appState,
                    onBack = appState::navigateToWelcome,
                    onPaired = appState::finishChildPairing,
                )
            }

            AppRoute.CHILD_UNLOCK -> WispelTheme(childRegister, isYoung = isYoung) {
                ChildUnlockScreen(
                    appState = appState,
                    activity = activity,
                    onUnlocked = appState::unlockChildHome,
                )
            }

            AppRoute.CHILD_HOME -> WispelTheme(childRegister, isYoung = isYoung) {
                ChildShell(appState = appState)
            }
        }

        // The gate and parent mode always render in the parent register, even when opened
        // from a child screen — crossing into parent mode should feel like a different
        // place, not a differently coloured version of the same one.
        if (isChallengePresented) {
            WispelTheme(WRegister.PARENT) {
                ParentGateSheet(appState = appState, activity = activity)
            }
        }

        if (isParentModePresented) {
            WispelTheme(WRegister.PARENT) {
                ParentModeScreen(appState = appState)
            }
        }
    }
}
