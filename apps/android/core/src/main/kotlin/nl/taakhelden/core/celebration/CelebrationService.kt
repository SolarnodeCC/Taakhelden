package nl.taakhelden.core.celebration

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Platform hooks for the reward moment (haptics + chime). */
public interface CelebrationEffects {
    public fun playSuccessHaptic()
    public fun playTaskCompleteChime()
    public val childSoundsEnabled: Boolean
}

/** No-op effects for tests and previews. */
public class NoopCelebrationEffects(
    override val childSoundsEnabled: Boolean = true,
) : CelebrationEffects {
    override fun playSuccessHaptic(): Unit = Unit
    override fun playTaskCompleteChime(): Unit = Unit
}

/**
 * Fires the reward moment when a child finishes a task.
 *
 * Haptic and chime play regardless of the motion preference — they are the celebration
 * for someone who cannot or does not want to see animation. The confetti token is only
 * bumped when Reduce Motion is off, so no animation is scheduled at all in that case.
 */
public class CelebrationService(
    private val effects: CelebrationEffects = NoopCelebrationEffects(),
) {
    private val _confettiToken = MutableStateFlow(0)
    public val confettiToken: StateFlow<Int> = _confettiToken.asStateFlow()

    public fun celebrateTaskCompleted(reduceMotion: Boolean) {
        effects.playSuccessHaptic()

        if (effects.childSoundsEnabled) {
            effects.playTaskCompleteChime()
        }

        if (!reduceMotion) {
            _confettiToken.value += 1
        }
    }
}
