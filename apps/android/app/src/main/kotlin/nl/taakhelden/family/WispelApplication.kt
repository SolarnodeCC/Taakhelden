package nl.taakhelden.family

import android.app.Application
import nl.taakhelden.family.push.WispelMessagingService

class WispelApplication : Application() {

    lateinit var environment: AppEnvironment
        private set

    override fun onCreate() {
        super.onCreate()
        environment = AppEnvironment(this)
        // Created up front so the very first push has a channel to land in, even if the
        // app has not yet asked for the notification permission.
        WispelMessagingService.ensureNotificationChannel(this)
    }
}
