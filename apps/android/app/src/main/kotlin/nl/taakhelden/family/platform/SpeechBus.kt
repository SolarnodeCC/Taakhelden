package nl.taakhelden.family.platform

import android.content.Context
import android.speech.tts.TextToSpeech
import android.view.accessibility.AccessibilityManager
import java.util.Locale

/**
 * Text-to-speech for young mode (4–7), where reading is not a given.
 *
 * Stays silent while TalkBack is running: two speech engines talking over each other is
 * worse than neither, and TalkBack already reads the content.
 */
class SpeechBus(context: Context) {

    private val applicationContext = context.applicationContext
    private var engine: TextToSpeech? = null
    private var isReady = false

    init {
        engine = TextToSpeech(applicationContext) { status ->
            if (status == TextToSpeech.SUCCESS) {
                engine?.language = Locale.forLanguageTag(DEFAULT_LANGUAGE_TAG)
                engine?.setSpeechRate(SPEECH_RATE)
                isReady = true
            }
        }
    }

    fun speak(text: String) {
        if (isScreenReaderRunning()) return
        val engine = engine.takeIf { isReady } ?: return
        // QUEUE_FLUSH: a second tap replaces the current sentence instead of stacking up.
        engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, UTTERANCE_ID)
    }

    /**
     * Releases the engine.
     *
     * Owned by `AppEnvironment` and therefore process-scoped: an Activity must **not**
     * call this on destroy, or a rotation would leave the next Activity holding a dead
     * engine and young mode would go silent. Kept for tests and for a future
     * process-level teardown.
     */
    fun shutdown() {
        engine?.stop()
        engine?.shutdown()
        engine = null
        isReady = false
    }

    private fun isScreenReaderRunning(): Boolean {
        val manager = applicationContext.getSystemService(AccessibilityManager::class.java)
            ?: return false
        return manager.isEnabled && manager.isTouchExplorationEnabled
    }

    private companion object {
        const val DEFAULT_LANGUAGE_TAG = "nl-NL"
        const val SPEECH_RATE = 0.9f
        const val UTTERANCE_ID = "wispel-speak"
    }
}
