package nl.taakhelden.core.child

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import nl.taakhelden.core.api.ChildRewardViewDTO
import nl.taakhelden.core.api.ChildRewardsViewDTO
import nl.taakhelden.core.api.PinRewardResultDTO
import nl.taakhelden.core.api.RedemptionViewDTO
import nl.taakhelden.core.api.SavingsGoalViewDTO
import nl.taakhelden.core.api.TaakHeldenApiClient
import nl.taakhelden.core.celebration.CelebrationService
import nl.taakhelden.core.sync.MutationQueue
import nl.taakhelden.core.sync.MutationQueueOutcome
import nl.taakhelden.core.sync.QueuedMutation
import nl.taakhelden.core.sync.QueuedMutationKind
import nl.taakhelden.core.sync.SyncEngine

/** Which shop message to show; the copy itself lives in the string catalog. */
public enum class ChildShopStatus {
    REDEEM_SUCCESS,
    INSUFFICIENT_POINTS,
    PINNED,
    PIN_ERROR,
}

public data class ChildShopState(
    val rewards: ChildRewardsViewDTO? = null,
    val redemptions: List<RedemptionViewDTO> = emptyList(),
    val isLoading: Boolean = false,
    val hasLoadError: Boolean = false,
    val status: ChildShopStatus? = null,
    val redeemingRewardId: String? = null,
    val pinningRewardId: String? = null,
) {
    public val pendingRedemptions: List<RedemptionViewDTO>
        get() = redemptions.filter { it.status == "pending" }
}

public class ChildShopStore(
    private val apiClient: TaakHeldenApiClient,
    private val mutationQueue: MutationQueue,
    private val syncEngine: SyncEngine,
    private val celebrationService: CelebrationService,
) {
    private val _state = MutableStateFlow(ChildShopState())
    public val state: StateFlow<ChildShopState> = _state.asStateFlow()

    public fun clearStatus() {
        _state.value = _state.value.copy(status = null)
    }

    public suspend fun load() {
        _state.value = _state.value.copy(isLoading = true)
        try {
            val rewards = apiClient.fetchChildRewards()
            val redemptions = apiClient.fetchChildRedemptions().redemptions
            _state.value = _state.value.copy(
                rewards = rewards,
                redemptions = redemptions,
                hasLoadError = false,
            )
        } catch (_: Exception) {
            _state.value = _state.value.copy(hasLoadError = true)
        } finally {
            _state.value = _state.value.copy(isLoading = false)
        }
    }

    public suspend fun redeem(rewardId: String, reduceMotion: Boolean) {
        val current = _state.value.rewards ?: return
        val reward = current.rewards.firstOrNull { it.id == rewardId } ?: return

        if (!reward.affordable) {
            _state.value = _state.value.copy(status = ChildShopStatus.INSUFFICIENT_POINTS)
            return
        }
        if (_state.value.redeemingRewardId != null) return

        _state.value = _state.value.copy(redeemingRewardId = rewardId)
        try {
            mutationQueue.enqueue(
                QueuedMutation(kind = QueuedMutationKind.REDEEM, targetId = rewardId),
            )
            // Optimistic: the balance drops immediately so a child never taps twice on a
            // reward they have already bought.
            _state.value = _state.value.copy(
                rewards = applyingRedeemOptimism(current, reward.price),
                status = ChildShopStatus.REDEEM_SUCCESS,
            )
            celebrationService.celebrateTaskCompleted(reduceMotion)

            val outcomes = syncEngine.syncNow()
            if (outcomes.any { it is MutationQueueOutcome.InsufficientPoints }) {
                _state.value = _state.value.copy(status = ChildShopStatus.INSUFFICIENT_POINTS)
            }
            load()
        } finally {
            _state.value = _state.value.copy(redeemingRewardId = null)
        }
    }

    public suspend fun pin(rewardId: String) {
        val current = _state.value.rewards ?: return
        if (_state.value.pinningRewardId != null) return

        _state.value = _state.value.copy(pinningRewardId = rewardId)
        try {
            val result = apiClient.pinReward(rewardId)
            val icon = current.rewards.firstOrNull { it.id == rewardId }?.icon
            _state.value = _state.value.copy(
                rewards = applyingPin(current, result, icon),
                status = ChildShopStatus.PINNED,
            )
            load()
        } catch (_: Exception) {
            _state.value = _state.value.copy(status = ChildShopStatus.PIN_ERROR)
        } finally {
            _state.value = _state.value.copy(pinningRewardId = null)
        }
    }

    public companion object {
        /**
         * Optimistic balance/affordability after enqueueing a redeem (test seam).
         *
         * The redeemed reward is not removed from the list — the server decides whether
         * the redemption stands. Only the balance drops, and every reward's affordability
         * is recomputed from it.
         */
        public fun applyingRedeemOptimism(
            current: ChildRewardsViewDTO,
            price: Int,
        ): ChildRewardsViewDTO {
            val newBalance = maxOf(0, current.balance - price)
            val updatedRewards = current.rewards.map { reward ->
                reward.copy(affordable = newBalance >= reward.price)
            }
            val goal = current.savingsGoal?.let { goal ->
                goal.copy(
                    progress = if (goal.price > 0) {
                        minOf(1.0, newBalance.toDouble() / goal.price.toDouble())
                    } else {
                        0.0
                    },
                )
            }
            return current.copy(
                balance = newBalance,
                rewards = updatedRewards,
                savingsGoal = goal,
            )
        }

        /** Optimistic pin + spaardoel card (test seam). */
        public fun applyingPin(
            current: ChildRewardsViewDTO,
            result: PinRewardResultDTO,
            icon: String?,
        ): ChildRewardsViewDTO {
            val updatedRewards: List<ChildRewardViewDTO> = current.rewards.map { reward ->
                reward.copy(pinned = reward.id == result.rewardId)
            }
            val goal = SavingsGoalViewDTO(
                rewardId = result.rewardId,
                title = result.title,
                icon = icon,
                price = result.price,
                progress = result.progress,
            )
            return current.copy(rewards = updatedRewards, savingsGoal = goal)
        }
    }
}
