package nl.taakhelden.core.focus

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

public enum class FocusTimerPhase {
    IDLE,
    RUNNING,
    PAUSED,
    COMPLETED,
}

public data class FocusTimerSnapshot(
    val phase: FocusTimerPhase = FocusTimerPhase.IDLE,
    val elapsedSeconds: Long = 0,
    val targetSeconds: Long = DEFAULT_TARGET_SECONDS,
) {
    public val progress: Double
        get() = if (targetSeconds <= 0) 0.0 else minOf(
            1.0,
            elapsedSeconds.toDouble() / targetSeconds.toDouble(),
        )

    public val remainingSeconds: Long get() = maxOf(0, targetSeconds - elapsedSeconds)

    public val formattedRemaining: String get() = format(remainingSeconds)

    public val formattedElapsed: String get() = format(elapsedSeconds)

    private fun format(total: Long): String = "%d:%02d".format(total / 60, total % 60)

    public companion object {
        public const val DEFAULT_TARGET_SECONDS: Long = 25 * 60
    }
}

/**
 * Client-side homework focus timer.
 *
 * Invariants (WS-FOCUS): no points are awarded for elapsed time, no server session is
 * logged, and it works fully offline. It is motivational scaffolding only — which is why
 * it never touches the ledger.
 */
public class FocusTimerService(
    private val scope: CoroutineScope,
    private val nowMillis: () -> Long = System::currentTimeMillis,
) {
    private val _state = MutableStateFlow(FocusTimerSnapshot())
    public val state: StateFlow<FocusTimerSnapshot> = _state.asStateFlow()

    private var tickJob: Job? = null
    private var startedAtMillis: Long? = null
    private var accumulatedBeforePause: Long = 0

    public fun start(targetSeconds: Long = FocusTimerSnapshot.DEFAULT_TARGET_SECONDS) {
        val current = _state.value
        if (current.phase != FocusTimerPhase.IDLE && current.phase != FocusTimerPhase.PAUSED) return

        if (current.phase == FocusTimerPhase.IDLE) {
            accumulatedBeforePause = 0
            _state.value = FocusTimerSnapshot(
                phase = FocusTimerPhase.RUNNING,
                elapsedSeconds = 0,
                targetSeconds = targetSeconds,
            )
        } else {
            _state.value = current.copy(phase = FocusTimerPhase.RUNNING)
        }

        startedAtMillis = nowMillis()
        scheduleTicks()
    }

    public fun pause() {
        if (_state.value.phase != FocusTimerPhase.RUNNING) return
        accumulatedBeforePause = _state.value.elapsedSeconds
        _state.value = _state.value.copy(phase = FocusTimerPhase.PAUSED)
        cancelTicks()
    }

    public fun stop() {
        cancelTicks()
        accumulatedBeforePause = 0
        startedAtMillis = null
        _state.value = FocusTimerSnapshot(targetSeconds = _state.value.targetSeconds)
    }

    private fun scheduleTicks() {
        cancelTicks()
        tickJob = scope.launch {
            while (isActive) {
                delay(TICK_INTERVAL_MS)
                tick()
                if (_state.value.phase != FocusTimerPhase.RUNNING) return@launch
            }
        }
    }

    private fun tick() {
        val startedAt = startedAtMillis ?: return
        val current = _state.value
        if (current.phase != FocusTimerPhase.RUNNING) return

        // Derive elapsed time from wall clock rather than counting ticks, so a paused
        // process or a throttled timer does not silently lose minutes.
        val elapsed = accumulatedBeforePause + (nowMillis() - startedAt) / 1000
        val clamped = minOf(elapsed, current.targetSeconds)

        _state.value = if (clamped >= current.targetSeconds) {
            cancelTicks()
            current.copy(elapsedSeconds = current.targetSeconds, phase = FocusTimerPhase.COMPLETED)
        } else {
            current.copy(elapsedSeconds = clamped)
        }
    }

    private fun cancelTicks() {
        tickJob?.cancel()
        tickJob = null
    }

    private companion object {
        const val TICK_INTERVAL_MS = 500L
    }
}
