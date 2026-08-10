package nl.taakhelden.family.platform

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import nl.taakhelden.core.celebration.CelebrationEffects

/**
 * Haptic and sound for the reward moment.
 *
 * Both fire regardless of the animation preference: for a child who has Reduce Motion on,
 * these *are* the celebration. Only the confetti is gated on motion (see
 * `CelebrationService`).
 */
class AndroidCelebrationEffects(
    private val context: Context,
    private val preferences: AppPreferences,
) : CelebrationEffects {

    override val childSoundsEnabled: Boolean
        get() = preferences.childSoundsEnabled

    private val vibrator: Vibrator? by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val manager = context.getSystemService(VibratorManager::class.java)
            manager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Vibrator::class.java)
        }
    }

    override fun playSuccessHaptic() {
        val vibrator = vibrator?.takeIf { it.hasVibrator() } ?: return
        // A short double tap reads as "yes, that worked" rather than an alarm.
        val effect = VibrationEffect.createWaveform(longArrayOf(0, 30, 60, 30), -1)
        runCatching { vibrator.vibrate(effect) }
    }

    override fun playTaskCompleteChime() {
        // A short, quiet positive tone on the notification stream, so it follows the
        // device's own volume and silent mode rather than overriding a parent's choice.
        runCatching {
            val generator = ToneGenerator(AudioManager.STREAM_NOTIFICATION, CHIME_VOLUME_PERCENT)
            generator.startTone(ToneGenerator.TONE_PROP_ACK, CHIME_DURATION_MS)
            // ToneGenerator is not auto-closeable and releasing it immediately cuts the
            // tone off, so it is released once the tone has finished — off the caller's
            // thread, which is the UI thread.
            Handler(Looper.getMainLooper()).postDelayed(
                { runCatching { generator.release() } },
                CHIME_DURATION_MS.toLong() + RELEASE_GRACE_MS,
            )
        }
    }

    private companion object {
        const val CHIME_VOLUME_PERCENT = 35
        const val CHIME_DURATION_MS = 180
        const val RELEASE_GRACE_MS = 120L
    }
}
