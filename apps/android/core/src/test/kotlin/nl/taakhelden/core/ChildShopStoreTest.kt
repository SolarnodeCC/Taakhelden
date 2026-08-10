package nl.taakhelden.core

import nl.taakhelden.core.api.ChildRewardViewDTO
import nl.taakhelden.core.api.ChildRewardsViewDTO
import nl.taakhelden.core.api.PinRewardResultDTO
import nl.taakhelden.core.api.RedemptionViewDTO
import nl.taakhelden.core.api.SavingsGoalViewDTO
import nl.taakhelden.core.child.ChildShopStore
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ChildShopStoreTest {

    private fun sampleRewards(balance: Int = 40) = ChildRewardsViewDTO(
        viewer = "child",
        balance = balance,
        rewards = listOf(
            ChildRewardViewDTO(
                id = "rw_ice",
                title = "IJsje",
                icon = "🍦",
                price = 30,
                affordable = balance >= 30,
                pinned = false,
            ),
            ChildRewardViewDTO(
                id = "rw_game",
                title = "Spelletje",
                icon = "🎲",
                price = 80,
                affordable = balance >= 80,
                pinned = false,
            ),
        ),
        savingsGoal = null,
    )

    @Test
    fun `redeem optimism lowers balance and affordability`() {
        val updated = ChildShopStore.applyingRedeemOptimism(sampleRewards(balance = 40), price = 30)

        assertEquals(10, updated.balance)
        assertFalse(updated.rewards.first { it.id == "rw_ice" }.affordable)
        assertFalse(updated.rewards.first { it.id == "rw_game" }.affordable)
    }

    @Test
    fun `redeem optimism updates savings goal progress`() {
        val current = sampleRewards(balance = 40).copy(
            savingsGoal = SavingsGoalViewDTO(
                rewardId = "rw_game",
                title = "Spelletje",
                icon = "🎲",
                price = 80,
                progress = 0.5,
            ),
        )
        val updated = ChildShopStore.applyingRedeemOptimism(current, price = 30)

        assertEquals(10, updated.balance)
        assertEquals(10.0 / 80.0, updated.savingsGoal?.progress ?: -1.0, 0.0001)
    }

    @Test
    fun `redeem optimism never drives the balance negative`() {
        val updated = ChildShopStore.applyingRedeemOptimism(sampleRewards(balance = 10), price = 30)

        // Architecture rule 4: no negative mechanics. Even an optimistic UI state must
        // never show a child a debt.
        assertEquals(0, updated.balance)
    }

    @Test
    fun `pin marks the reward and sets the savings goal`() {
        val result = PinRewardResultDTO(
            rewardId = "rw_game",
            title = "Spelletje",
            price = 80,
            progress = 0.5,
        )
        val updated = ChildShopStore.applyingPin(sampleRewards(balance = 40), result, icon = "🎲")

        assertTrue(updated.rewards.first { it.id == "rw_game" }.pinned)
        assertFalse(updated.rewards.first { it.id == "rw_ice" }.pinned)
        assertEquals("rw_game", updated.savingsGoal?.rewardId)
        assertEquals(0.5, updated.savingsGoal?.progress ?: -1.0, 0.0001)
        assertEquals("🎲", updated.savingsGoal?.icon)
    }

    @Test
    fun `pending redemptions filter keeps only pending`() {
        val pending = RedemptionViewDTO(
            id = "rd_1",
            rewardId = "rw_ice",
            title = "IJsje",
            icon = "🍦",
            price = 30,
            childId = "ch_1",
            status = "pending",
            createdAt = "2026-07-30T00:00:00Z",
        )
        val fulfilled = pending.copy(
            id = "rd_2",
            rewardId = "rw_game",
            status = "fulfilled",
            handledAt = "2026-07-29T01:00:00Z",
        )

        val state = nl.taakhelden.core.child.ChildShopState(
            redemptions = listOf(pending, fulfilled),
        )
        assertEquals(listOf("rd_1"), state.pendingRedemptions.map { it.id })
    }
}
