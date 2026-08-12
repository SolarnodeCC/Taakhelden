package nl.taakhelden.core.gate

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import nl.taakhelden.core.auth.ChildAgeBand
import java.time.Duration
import java.time.Instant

public enum class ParentGateEntryPoint {
    HERO_WORDMARK_LONG_PRESS,
    BUILD_NUMBER_FIVE_TAP,
}

public enum class ParentGateUnlockMethod {
    DEVICE_AUTHENTICATION,
    PARENT_ACCOUNT,
}

public enum class ChildUnlockMode {
    PIN_ONLY,
    BIOMETRICS_WITH_VISIBLE_PIN,
    BIOMETRICS_WITH_OPTIONAL_PIN,
}

public object ParentGatePolicy {
    /** Child mode has exactly three tabs — no permanent parent tab (ADR-0003). */
    public const val CHILD_TAB_COUNT: Int = 3

    public const val IDLE_TIMEOUT_MINUTES: Int = 10

    /**
     * Parent mode is reachable only through non-obvious gestures, so a child poking at
     * the app never stumbles into approvals or privacy actions.
     */
    public val hiddenEntryPoints: List<ParentGateEntryPoint> = listOf(
        ParentGateEntryPoint.HERO_WORDMARK_LONG_PRESS,
        ParentGateEntryPoint.BUILD_NUMBER_FIVE_TAP,
    )

    public fun childUnlockMode(
        ageBand: ChildAgeBand,
        biometricsEnabled: Boolean,
    ): ChildUnlockMode = when {
        ageBand.requiresVisiblePinAlternative -> ChildUnlockMode.BIOMETRICS_WITH_VISIBLE_PIN
        biometricsEnabled -> ChildUnlockMode.BIOMETRICS_WITH_OPTIONAL_PIN
        else -> ChildUnlockMode.PIN_ONLY
    }
}

public class ParentGateCoordinator {
    private val _isChallengePresented = MutableStateFlow(false)
    public val isChallengePresented: StateFlow<Boolean> = _isChallengePresented.asStateFlow()

    private val _isParentModePresented = MutableStateFlow(false)
    public val isParentModePresented: StateFlow<Boolean> = _isParentModePresented.asStateFlow()

    private val _activeEntryPoint = MutableStateFlow<ParentGateEntryPoint?>(null)
    public val activeEntryPoint: StateFlow<ParentGateEntryPoint?> = _activeEntryPoint.asStateFlow()

    public var lastUnlockMethod: ParentGateUnlockMethod? = null
        private set

    public var lastUnlockedAt: Instant? = null
        private set

    public fun openGate(entryPoint: ParentGateEntryPoint? = null) {
        if (entryPoint != null) _activeEntryPoint.value = entryPoint
        _isChallengePresented.value = true
    }

    public fun unlock(method: ParentGateUnlockMethod, now: Instant = Instant.now()) {
        lastUnlockMethod = method
        lastUnlockedAt = now
        _isChallengePresented.value = false
        _isParentModePresented.value = true
    }

    public fun closeGate() {
        _isChallengePresented.value = false
        _activeEntryPoint.value = null
    }

    public fun closeParentMode() {
        _isParentModePresented.value = false
        closeGate()
    }

    /**
     * Parent mode expires on idle so a tablet left on the kitchen table does not stay
     * unlocked into approvals.
     */
    public fun parentSessionRequiresReauth(now: Instant = Instant.now()): Boolean {
        val unlockedAt = lastUnlockedAt ?: return true
        val elapsedMinutes = Duration.between(unlockedAt, now).toMinutes()
        return elapsedMinutes >= ParentGatePolicy.IDLE_TIMEOUT_MINUTES
    }
}
