package nl.taakhelden.family.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import nl.taakhelden.core.auth.AppRestoreRoute
import nl.taakhelden.core.gate.ParentGateEntryPoint
import nl.taakhelden.core.gate.ParentGateUnlockMethod
import nl.taakhelden.core.parent.ParentModeStore
import nl.taakhelden.core.parent.ParentSurface
import nl.taakhelden.family.AppEnvironment

enum class AppRoute {
    WELCOME,
    PARENT_ONBOARDING,
    CHILD_PAIRING,
    CHILD_UNLOCK,
    CHILD_HOME,
}

enum class ChildTab {
    MIJN_DAG,
    WINKEL,
    MIJN_STER,
}

/**
 * Top-level navigation and cross-cutting app coordination.
 *
 * A ViewModel rather than composable state so a rotation or a language change never drops
 * the parent-mode session or the realtime connection mid-approval.
 */
class AppState(val environment: AppEnvironment) : ViewModel() {

    private val _route = MutableStateFlow(AppRoute.WELCOME)
    val route: StateFlow<AppRoute> = _route.asStateFlow()

    private val _selectedChildTab = MutableStateFlow(ChildTab.MIJN_DAG)
    val selectedChildTab: StateFlow<ChildTab> = _selectedChildTab.asStateFlow()

    private var pendingParentDeepLinkSurface: ParentSurface? = null

    val parentMode: ParentModeStore = ParentModeStore(
        api = environment.parentApi,
        familyRoomClient = environment.familyRoomClient,
        scope = viewModelScope,
        openTaskCountSink = environment.preferences,
    )

    val parentGate = environment.parentGate
    val authStore = environment.authStore

    init {
        restoreSessionIfAvailable()
    }

    fun selectChildTab(tab: ChildTab) {
        _selectedChildTab.value = tab
    }

    private fun restoreSessionIfAvailable() {
        _route.value = when (authStore.restoredRoute) {
            AppRestoreRoute.CHILD_HOME -> AppRoute.CHILD_HOME
            AppRestoreRoute.CHILD_UNLOCK -> AppRoute.CHILD_UNLOCK
            AppRestoreRoute.PARENT_ONBOARDING -> AppRoute.PARENT_ONBOARDING
            AppRestoreRoute.WELCOME -> AppRoute.WELCOME
        }
    }

    fun openParentOnboarding() {
        _route.value = AppRoute.PARENT_ONBOARDING
    }

    fun openChildPairing() {
        _route.value = AppRoute.CHILD_PAIRING
    }

    fun finishChildPairing() {
        _route.value = AppRoute.CHILD_HOME
    }

    fun unlockChildHome() {
        authStore.unlockChildSession()
        _route.value = AppRoute.CHILD_HOME
    }

    fun openParentGate(
        entryPoint: ParentGateEntryPoint,
        preferSurface: ParentSurface? = null,
    ) {
        if (preferSurface != null) pendingParentDeepLinkSurface = preferSurface
        parentGate.openGate(entryPoint)
    }

    fun unlockParentMode(method: ParentGateUnlockMethod) {
        parentGate.unlock(method)
        applyPendingDeepLinkSurface()
    }

    fun closeParentMode() {
        parentMode.endSession()
        parentGate.closeParentMode()
        pendingParentDeepLinkSurface = null
    }

    /**
     * Signs the current user out.
     *
     * The push token is detached *before* the session is cleared — afterwards there is no
     * token to authenticate the de-registration with, and the departing user would keep
     * receiving this family's notifications.
     */
    fun returnToWelcome() {
        viewModelScope.launch {
            if (authStore.childSession != null || authStore.parentSession != null) {
                environment.pushService.deregisterCurrentUser()
            }
            authStore.clearAllSessions()
            _route.value = AppRoute.WELCOME
        }
    }

    /** Called when the app is backgrounded: the child home always re-locks. */
    fun handleAppBackgrounded() {
        authStore.lockChildSession()
        if (_route.value == AppRoute.CHILD_HOME) {
            _route.value = AppRoute.CHILD_UNLOCK
        }
    }

    fun handleAppForegrounded() {
        if (parentGate.isParentModePresented.value &&
            parentGate.parentSessionRequiresReauth()
        ) {
            closeParentMode()
        }
        if (_route.value == AppRoute.CHILD_HOME) {
            viewModelScope.launch { environment.syncEngine.syncNow() }
        }
        viewModelScope.launch { environment.pushService.registerIfNeeded() }
    }

    fun handleBackgroundPushRefresh() {
        viewModelScope.launch {
            environment.syncEngine.syncNow()
            if (parentGate.isParentModePresented.value) {
                parentMode.handleBackgroundPushRefresh()
            }
        }
    }

    fun handlePushDeepLink() {
        if (_route.value == AppRoute.CHILD_HOME) {
            openParentGate(
                ParentGateEntryPoint.HERO_WORDMARK_LONG_PRESS,
                preferSurface = ParentSurface.GOEDKEUREN,
            )
        }
    }

    private fun applyPendingDeepLinkSurface() {
        pendingParentDeepLinkSurface?.let { surface ->
            parentMode.setActiveSurface(surface)
            pendingParentDeepLinkSurface = null
        }
    }

    override fun onCleared() {
        super.onCleared()
        environment.familyRoomClient.disconnect()
    }

    class Factory(private val environment: AppEnvironment) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T = AppState(environment) as T
    }
}
