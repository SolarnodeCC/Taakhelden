package nl.taakhelden.family.ui.child

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import nl.taakhelden.core.api.ChildRewardViewDTO
import nl.taakhelden.core.api.SavingsGoalViewDTO
import nl.taakhelden.core.child.ChildShopStatus
import nl.taakhelden.family.R
import nl.taakhelden.family.ui.AppState
import nl.taakhelden.family.ui.components.WBadge
import nl.taakhelden.family.ui.components.WCard
import nl.taakhelden.family.ui.components.WPrimaryButton
import nl.taakhelden.family.ui.components.WProgressBar
import nl.taakhelden.family.ui.components.WSecondaryButton
import nl.taakhelden.family.ui.components.YoungSpeakButton
import nl.taakhelden.family.ui.theme.WDimens
import nl.taakhelden.family.ui.theme.WispelTheme
import nl.taakhelden.family.ui.theme.color

@Composable
fun WinkelTab(
    appState: AppState,
    viewModel: ChildViewModel,
    isTeen: Boolean,
    reduceMotion: Boolean,
) {
    val palette = WispelTheme.palette
    val isYoung = WispelTheme.isYoung
    val speechBus = appState.environment.speechBus
    val state by viewModel.shop.state.collectAsState()

    // Pull to refresh: the shop changes when a parent adds a reward or approves a
    // redemption, and a child should not have to leave the tab to find out.
    PullToRefreshBox(
        isRefreshing = state.isLoading,
        onRefresh = viewModel::refreshShop,
        modifier = Modifier.fillMaxSize(),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(WDimens.spacingXl),
            verticalArrangement = Arrangement.spacedBy(WDimens.spacingLg),
        ) {
            val rewards = state.rewards

            when {
                state.isLoading && rewards == null -> Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(WDimens.spacingMd),
                ) {
                    CircularProgressIndicator(color = palette.accent.color)
                    Text(
                        text = stringResource(R.string.child_shop_loading),
                        color = palette.mutedText.color,
                    )
                }

                rewards != null -> {
                    WCard {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(WDimens.spacingSm),
                        ) {
                            Text(
                                text = stringResource(R.string.child_shop_title),
                                style = MaterialTheme.typography.displaySmall,
                                fontWeight = FontWeight.Bold,
                                color = palette.text.color,
                            )
                            if (isYoung) {
                                YoungSpeakButton(
                                    text = stringResource(
                                        R.string.child_shop_balance_speak,
                                        rewards.balance,
                                    ),
                                    speechBus = speechBus,
                                )
                            }
                        }
                        Text(
                            text = stringResource(R.string.child_shop_balance, rewards.balance),
                            color = palette.mutedText.color,
                        )
                    }

                    state.status?.let { status ->
                        Text(
                            text = stringResource(
                                when (status) {
                                    ChildShopStatus.REDEEM_SUCCESS -> R.string.child_shop_redeem_success
                                    ChildShopStatus.INSUFFICIENT_POINTS ->
                                        R.string.child_shop_insufficient
                                    ChildShopStatus.PINNED -> R.string.child_shop_pinned
                                    ChildShopStatus.PIN_ERROR -> R.string.child_shop_pin_error
                                },
                            ),
                            style = MaterialTheme.typography.bodyMedium,
                            color = palette.mutedText.color,
                        )
                    }

                    rewards.savingsGoal?.let { goal ->
                        SavingsGoalCard(goal = goal, balance = rewards.balance, isTeen = isTeen)
                    }

                    state.pendingRedemptions.forEach { redemption ->
                        WCard {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(WDimens.spacingMd),
                            ) {
                                Text(
                                    text = redemption.icon ?: "🎁",
                                    fontSize = 28.sp,
                                    modifier = Modifier.clearAndSetSemantics { },
                                )
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(text = redemption.title, color = palette.text.color)
                                    Text(
                                        text = stringResource(R.string.child_shop_pending),
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = palette.mutedText.color,
                                    )
                                }
                                WBadge(
                                    text = stringResource(
                                        R.string.child_points_badge,
                                        redemption.price,
                                    ),
                                )
                            }
                        }
                    }

                    if (rewards.rewards.isEmpty()) {
                        WCard {
                            Text(
                                text = stringResource(R.string.child_shop_empty),
                                color = palette.text.color,
                            )
                        }
                    } else {
                        rewards.rewards.forEach { reward ->
                            RewardCard(
                                reward = reward,
                                balance = rewards.balance,
                                isTeen = isTeen,
                                isRedeeming = state.redeemingRewardId == reward.id,
                                isPinning = state.pinningRewardId == reward.id,
                                onRedeem = { viewModel.redeem(reward.id, reduceMotion) },
                                onPin = { viewModel.pin(reward.id) },
                            )
                        }
                    }
                }

                state.hasLoadError -> WCard {
                    Text(
                        text = stringResource(R.string.child_shop_load_error),
                        color = palette.text.color,
                    )
                    WSecondaryButton(
                        text = stringResource(R.string.child_retry),
                        onClick = viewModel::refreshShop,
                    )
                }
            }
        }
    }
}

@Composable
private fun SavingsGoalCard(
    goal: SavingsGoalViewDTO,
    balance: Int,
    isTeen: Boolean,
) {
    val palette = WispelTheme.palette
    val remaining = maxOf(0, goal.price - balance)

    WCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(WDimens.spacingMd),
        ) {
            Text(
                text = goal.icon ?: "🎯",
                fontSize = 28.sp,
                modifier = Modifier.clearAndSetSemantics { },
            )
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(WDimens.spacingSm),
            ) {
                Text(
                    text = stringResource(R.string.child_shop_pinned),
                    style = MaterialTheme.typography.titleMedium,
                    color = palette.text.color,
                )
                Text(text = goal.title, color = palette.text.color)
                WProgressBar(fraction = goal.progress.toFloat())
                Text(
                    text = stringResource(
                        if (isTeen) {
                            R.string.child_shop_goal_progress_teen
                        } else {
                            R.string.child_shop_goal_progress
                        },
                        remaining,
                        goal.title,
                    ),
                    style = MaterialTheme.typography.bodyMedium,
                    color = palette.mutedText.color,
                )
            }
        }
    }
}

@Composable
private fun RewardCard(
    reward: ChildRewardViewDTO,
    balance: Int,
    isTeen: Boolean,
    isRedeeming: Boolean,
    isPinning: Boolean,
    onRedeem: () -> Unit,
    onPin: () -> Unit,
) {
    val palette = WispelTheme.palette
    val isYoung = WispelTheme.isYoung

    WCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(WDimens.spacingMd),
        ) {
            if (isTeen) {
                Icon(
                    imageVector = Icons.Filled.CardGiftcard,
                    contentDescription = null,
                    tint = palette.accent.color,
                )
            } else {
                Text(
                    text = reward.icon ?: "🎁",
                    fontSize = if (isYoung) 36.sp else 28.sp,
                    modifier = Modifier.clearAndSetSemantics { },
                )
            }

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(WDimens.spacingXs),
            ) {
                Text(text = reward.title, color = palette.text.color)
                // Never "you can't afford this" — always how far there is still to go.
                val subtitle = when {
                    reward.pinned -> stringResource(R.string.child_shop_pinned)
                    reward.affordable -> stringResource(
                        if (isTeen) {
                            R.string.child_shop_affordable_teen
                        } else {
                            R.string.child_shop_affordable
                        },
                    )

                    else -> stringResource(
                        R.string.child_shop_need_more,
                        maxOf(0, reward.price - balance),
                        reward.title,
                    )
                }
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (reward.pinned) palette.accent.color else palette.mutedText.color,
                )
            }

            WBadge(text = stringResource(R.string.child_points_badge, reward.price))
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(WDimens.spacingSm),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (!reward.pinned) {
                WSecondaryButton(
                    text = stringResource(R.string.child_shop_pin),
                    onClick = onPin,
                    enabled = !isPinning && !isRedeeming,
                )
            }

            Spacer(modifier = Modifier.weight(1f))

            if (reward.affordable) {
                WPrimaryButton(
                    text = stringResource(
                        if (isYoung) R.string.child_shop_redeem_young else R.string.child_shop_redeem,
                    ),
                    onClick = onRedeem,
                    enabled = !isRedeeming && !isPinning,
                )
            }
        }
    }
}
