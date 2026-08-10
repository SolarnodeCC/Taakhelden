package nl.taakhelden.family.ui.child

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch
import nl.taakhelden.core.child.AvatarShopStore
import nl.taakhelden.core.child.ChildDayStore
import nl.taakhelden.core.child.ChildShopStore
import nl.taakhelden.core.child.FamilyGoalStore
import nl.taakhelden.core.child.TaskProposalStore
import nl.taakhelden.core.focus.FocusTimerService
import nl.taakhelden.family.AppEnvironment

/**
 * Owns the child-side stores for the lifetime of the child home.
 *
 * They live in a ViewModel so a rotation does not re-fetch the day, lose the optimistic
 * "done" state of a task the child just tapped, or restart a running focus timer.
 */
class ChildViewModel(
    environment: AppEnvironment,
    childId: String?,
) : ViewModel() {

    val day = ChildDayStore(
        apiClient = environment.apiClient,
        mutationQueue = environment.mutationQueue,
        syncEngine = environment.syncEngine,
        celebrationService = environment.celebrationService,
        photoBonusService = environment.photoBonusService,
    )

    val shop = ChildShopStore(
        apiClient = environment.apiClient,
        mutationQueue = environment.mutationQueue,
        syncEngine = environment.syncEngine,
        celebrationService = environment.celebrationService,
    )

    val familyGoal = FamilyGoalStore(environment.apiClient)

    /** Only meaningful once a child is paired; the Mijn Ster tab guards on it. */
    val avatarShop: AvatarShopStore? = childId?.let {
        AvatarShopStore(environment.apiClient, it)
    }

    val proposals = TaskProposalStore(environment.apiClient)

    val focusTimer = FocusTimerService(viewModelScope)

    val confettiToken = environment.celebrationService.confettiToken

    val mutationQueue = environment.mutationQueue
    val syncEngine = environment.syncEngine

    fun loadAll() {
        viewModelScope.launch { day.load() }
        viewModelScope.launch { shop.load() }
        viewModelScope.launch { familyGoal.load() }
    }

    fun refreshDay() {
        viewModelScope.launch {
            day.load()
            familyGoal.load()
        }
    }

    fun completeTask(instanceId: String, reduceMotion: Boolean) {
        viewModelScope.launch { day.complete(instanceId, reduceMotion) }
    }

    fun undoTask(instanceId: String) {
        viewModelScope.launch { day.undo(instanceId) }
    }

    fun uploadPhoto(instanceId: String, jpeg: ByteArray) {
        viewModelScope.launch { day.uploadPhoto(instanceId, jpeg) }
    }

    fun refreshShop() {
        viewModelScope.launch { shop.load() }
    }

    fun redeem(rewardId: String, reduceMotion: Boolean) {
        viewModelScope.launch { shop.redeem(rewardId, reduceMotion) }
    }

    fun pin(rewardId: String) {
        viewModelScope.launch { shop.pin(rewardId) }
    }

    class Factory(
        private val environment: AppEnvironment,
        private val childId: String?,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            ChildViewModel(environment, childId) as T
    }
}
