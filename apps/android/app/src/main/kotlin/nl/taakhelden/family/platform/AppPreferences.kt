package nl.taakhelden.family.platform

import android.content.Context
import nl.taakhelden.core.parent.OpenTaskCountSink
import nl.taakhelden.core.parent.ParentPreferences

/**
 * Ordinary device preferences — deliberately *not* in the encrypted store.
 *
 * These are settings, not secrets: the reward-sound toggle and the open-task count the
 * home-screen widget reads. The widget runs in a separate process context and cannot
 * open the encrypted file, which is another reason to keep them apart.
 */
class AppPreferences(context: Context) : ParentPreferences, OpenTaskCountSink {

    private val preferences =
        context.applicationContext.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)

    override var childSoundsEnabled: Boolean
        get() = preferences.getBoolean(KEY_CHILD_SOUNDS, true)
        set(value) = preferences.edit().putBoolean(KEY_CHILD_SOUNDS, value).apply()

    /**
     * Whether the notification primer has already been shown.
     *
     * Without this the primer reappeared on every visit to the child home for anyone who
     * declined — nagging a child for a permission they already said no to.
     */
    var pushPrimerShown: Boolean
        get() = preferences.getBoolean(KEY_PUSH_PRIMER_SHOWN, false)
        set(value) = preferences.edit().putBoolean(KEY_PUSH_PRIMER_SHOWN, value).apply()

    override fun update(count: Int) {
        if (preferences.getInt(KEY_OPEN_TASK_COUNT, -1) == count) return
        preferences.edit().putInt(KEY_OPEN_TASK_COUNT, count).apply()
        // Writing the preference is not enough: without an explicit update the widget
        // keeps showing a stale count until its 15-minute refresh window.
        onOpenTaskCountChanged?.invoke(count)
    }

    /** Set by [nl.taakhelden.family.AppEnvironment] to push the new count to the widget. */
    var onOpenTaskCountChanged: ((Int) -> Unit)? = null

    val openTaskCount: Int get() = preferences.getInt(KEY_OPEN_TASK_COUNT, 0)

    companion object {
        const val FILE_NAME = "wispel_prefs"
        const val KEY_CHILD_SOUNDS = "childSoundsEnabled"
        const val KEY_OPEN_TASK_COUNT = "openTaskCount"
        const val KEY_PUSH_PRIMER_SHOWN = "pushPrimerShown"

        /** Read-only accessor for the widget, which has no `AppEnvironment`. */
        fun openTaskCount(context: Context): Int =
            context.applicationContext
                .getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)
                .getInt(KEY_OPEN_TASK_COUNT, 0)
    }
}
