package nl.taakhelden.family.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import nl.taakhelden.family.R

/**
 * Receives FCM messages.
 *
 * Two shapes arrive, matching the Worker's `notifier.ts`:
 *  - a *notification* message, which the system displays with the generic Wispel copy the
 *    Worker composed — never a task name or a photo on the lock screen (privacy rule 5);
 *  - a *data-only* message (`contentAvailable`), which is a silent nudge to re-sync.
 *
 * Deep links and silent refreshes are published on [events]; `MainActivity` collects them
 * and routes through the parental gate, exactly as the iOS app does.
 */
class WispelMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        // The app registers the token the next time it is in the foreground with a live
        // session; a background service has no authenticated client to register with.
        _events.tryEmit(PushEvent.TokenRefreshed(token))
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val isSilent = message.notification == null
        _events.tryEmit(if (isSilent) PushEvent.SilentRefresh else PushEvent.DeepLinkToApprovals)
    }

    companion object {
        /**
         * No replay on purpose.
         *
         * With `replay = 1` the last push was re-delivered to every new collector, so
         * `repeatOnLifecycle` would re-fire it on each foreground and pop the parental
         * gate open again long after the notification was handled. A missed silent
         * refresh is harmless — `onStart` syncs anyway.
         */
        private val _events = MutableSharedFlow<PushEvent>(
            replay = 0,
            extraBufferCapacity = 8,
        )

        val events: SharedFlow<PushEvent> = _events

        /**
         * Creates the notification channel the Worker's messages target. Called at app
         * start so the very first push has somewhere to land.
         */
        fun ensureNotificationChannel(context: Context) {
            val manager = context.getSystemService(NotificationManager::class.java) ?: return
            val channelId = context.getString(R.string.push_channel_id)
            if (manager.getNotificationChannel(channelId) != null) return

            val channel = NotificationChannel(
                channelId,
                context.getString(R.string.push_channel_name),
                // DEFAULT, not HIGH: these are gentle reminders for a family app, and
                // they must never interrupt with a heads-up banner during dinner.
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = context.getString(R.string.push_channel_description)
                setShowBadge(true)
            }
            manager.createNotificationChannel(channel)
        }
    }
}

sealed interface PushEvent {
    /** A visible push was tapped or received — route to approvals behind the gate. */
    data object DeepLinkToApprovals : PushEvent

    /** A silent push asking the app to re-sync. */
    data object SilentRefresh : PushEvent

    data class TokenRefreshed(val token: String) : PushEvent
}
