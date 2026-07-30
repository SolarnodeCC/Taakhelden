import XCTest
@testable import TaakHelden

final class ChildShopViewModelTests: XCTestCase {
    private func sampleRewards(balance: Int = 40) -> ChildRewardsViewDTO {
        ChildRewardsViewDTO(
            viewer: "child",
            balance: balance,
            rewards: [
                ChildRewardViewDTO(
                    id: "rw_ice",
                    title: "IJsje",
                    icon: "🍦",
                    price: 30,
                    limitPerWeek: nil,
                    affordable: balance >= 30,
                    pinned: false
                ),
                ChildRewardViewDTO(
                    id: "rw_game",
                    title: "Spelletje",
                    icon: "🎲",
                    price: 80,
                    limitPerWeek: nil,
                    affordable: balance >= 80,
                    pinned: false
                ),
            ],
            savingsGoal: nil
        )
    }

    func testApplyingRedeemOptimismLowersBalanceAndAffordability() {
        let current = sampleRewards(balance: 40)
        let updated = ChildShopViewModel.applyingRedeemOptimism(to: current, rewardID: "rw_ice", price: 30)

        XCTAssertEqual(updated.balance, 10)
        XCTAssertEqual(updated.rewards.first(where: { $0.id == "rw_ice" })?.affordable, false)
        XCTAssertEqual(updated.rewards.first(where: { $0.id == "rw_game" })?.affordable, false)
    }

    func testApplyingRedeemOptimismUpdatesSavingsGoalProgress() {
        let current = ChildRewardsViewDTO(
            viewer: "child",
            balance: 40,
            rewards: sampleRewards().rewards,
            savingsGoal: SavingsGoalViewDTO(
                rewardId: "rw_game",
                title: "Spelletje",
                icon: "🎲",
                price: 80,
                progress: 0.5
            )
        )
        let updated = ChildShopViewModel.applyingRedeemOptimism(to: current, rewardID: "rw_ice", price: 30)
        XCTAssertEqual(updated.balance, 10)
        XCTAssertEqual(updated.savingsGoal?.progress ?? -1, 10.0 / 80.0, accuracy: 0.0001)
    }

    func testApplyingPinMarksRewardAndSetsGoal() {
        let current = sampleRewards(balance: 40)
        let result = PinRewardResultDTO(rewardId: "rw_game", title: "Spelletje", price: 80, progress: 0.5)
        let updated = ChildShopViewModel.applyingPin(to: current, result: result, icon: "🎲")

        XCTAssertEqual(updated.rewards.first(where: { $0.id == "rw_game" })?.pinned, true)
        XCTAssertEqual(updated.rewards.first(where: { $0.id == "rw_ice" })?.pinned, false)
        XCTAssertEqual(updated.savingsGoal?.rewardId, "rw_game")
        XCTAssertEqual(updated.savingsGoal?.progress, 0.5)
        XCTAssertEqual(updated.savingsGoal?.icon, "🎲")
    }

    func testPendingRedemptionsFilter() {
        let pending = RedemptionViewDTO(
            id: "rd_1",
            rewardId: "rw_ice",
            title: "IJsje",
            icon: "🍦",
            price: 30,
            childId: "ch_1",
            status: "pending",
            createdAt: "2026-07-30T00:00:00Z",
            handledAt: nil
        )
        let fulfilled = RedemptionViewDTO(
            id: "rd_2",
            rewardId: "rw_game",
            title: "Spelletje",
            icon: "🎲",
            price: 80,
            childId: "ch_1",
            status: "fulfilled",
            createdAt: "2026-07-29T00:00:00Z",
            handledAt: "2026-07-29T01:00:00Z"
        )
        let filtered = [pending, fulfilled].filter { $0.status == "pending" }
        XCTAssertEqual(filtered.map(\.id), ["rd_1"])
    }
}
