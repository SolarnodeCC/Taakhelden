package nl.taakhelden.family

import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.plus
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import nl.taakhelden.family.widget.OpenTasksWidget
import androidx.glance.appwidget.updateAll
import nl.taakhelden.core.api.OkHttpTransport
import nl.taakhelden.core.api.TaakHeldenApiClient
import nl.taakhelden.core.auth.AuthStore
import nl.taakhelden.core.celebration.CelebrationService
import nl.taakhelden.core.config.AppConfiguration
import nl.taakhelden.core.gate.ParentGateCoordinator
import nl.taakhelden.core.parent.ParentApi
import nl.taakhelden.core.parent.ParentApiAdapter
import nl.taakhelden.core.realtime.FamilyRoomClient
import nl.taakhelden.core.realtime.LiveFamilyRoomClient
import nl.taakhelden.core.sync.FileMutationQueueStore
import nl.taakhelden.core.sync.MutationQueue
import nl.taakhelden.core.sync.PhotoBonusService
import nl.taakhelden.core.sync.SyncEngine
import nl.taakhelden.family.auth.AppleSignInConfig
import nl.taakhelden.family.auth.AppleSignInFlow
import nl.taakhelden.family.platform.AndroidCelebrationEffects
import nl.taakhelden.family.platform.AppPreferences
import nl.taakhelden.family.platform.EncryptedSecureStore
import nl.taakhelden.family.platform.SpeechBus
import nl.taakhelden.family.push.PushRegistrationService
import java.io.File

/**
 * Composition root — one instance per process, owned by [WispelApplication].
 *
 * Everything the app needs is constructed here rather than injected by a framework: the
 * graph is small, fixed, and the explicit wiring makes the dependency direction (UI →
 * core, never the reverse) obvious.
 */
class AppEnvironment(context: Context) {

    private val applicationContext = context.applicationContext

    /** Survives configuration changes; cancelled only when the process dies. */
    val applicationScope: CoroutineScope = CoroutineScope(SupervisorJob()) + Dispatchers.Main.immediate

    val preferences: AppPreferences = AppPreferences(applicationContext).apply {
        onOpenTaskCountChanged = {
            // Glance updates are suspend work; the count has already been persisted, so
            // this only has to redraw whatever widgets are on the home screen.
            applicationScope.launch {
                runCatching { OpenTasksWidget().updateAll(applicationContext) }
            }
        }
    }

    val authStore: AuthStore = AuthStore(EncryptedSecureStore(applicationContext))

    val apiBaseUrl: String = AppConfiguration.apiBaseUrl(
        buildConfigValue = BuildConfig.API_BASE_URL_OVERRIDE,
    )

    val apiClient: TaakHeldenApiClient = TaakHeldenApiClient(
        transport = OkHttpTransport(apiBaseUrl),
        authStore = authStore,
    )

    val mutationQueue: MutationQueue = MutationQueue(
        FileMutationQueueStore(File(applicationContext.filesDir, MUTATION_QUEUE_FILE)),
    )

    val syncEngine: SyncEngine = SyncEngine(apiClient, mutationQueue)

    val photoBonusService: PhotoBonusService = PhotoBonusService(apiClient)

    val celebrationService: CelebrationService = CelebrationService(
        AndroidCelebrationEffects(applicationContext, preferences),
    )

    val parentApi: ParentApi = ParentApiAdapter(apiClient, authStore, preferences)

    val familyRoomClient: FamilyRoomClient = LiveFamilyRoomClient(
        apiClient = apiClient,
        baseUrl = apiBaseUrl,
        scope = applicationScope,
    )

    val parentGate: ParentGateCoordinator = ParentGateCoordinator()

    val pushService: PushRegistrationService = PushRegistrationService(apiClient)

    val speechBus: SpeechBus = SpeechBus(applicationContext)

    val appleSignIn: AppleSignInFlow = AppleSignInFlow(
        AppleSignInConfig(
            clientId = APPLE_SERVICES_ID,
            redirectUri = APPLE_REDIRECT_URI,
            appRedirectScheme = applicationContext.getString(R.string.apple_redirect_scheme),
        ),
    )

    private companion object {
        const val MUTATION_QUEUE_FILE = "mutation-queue.json"

        /**
         * Apple Services ID and the https bounce page that returns the identity token to
         * this app. Blank until the Wispel Apple Developer account is configured; the
         * sign-in button then explains that parent sign-in is not available yet rather
         * than opening a broken web page (see `AppleSignInFlow`).
         */
        const val APPLE_SERVICES_ID = ""
        const val APPLE_REDIRECT_URI = ""
    }
}
