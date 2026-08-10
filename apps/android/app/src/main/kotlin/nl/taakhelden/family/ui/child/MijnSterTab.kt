package nl.taakhelden.family.ui.child

import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import nl.taakhelden.core.child.ChildDayLoadState
import nl.taakhelden.core.designsystem.HeroProgress
import nl.taakhelden.core.gate.ParentGateEntryPoint
import nl.taakhelden.family.R
import nl.taakhelden.family.ui.AppState
import nl.taakhelden.family.ui.avatar.AvatarShopSection
import nl.taakhelden.family.ui.components.WCard
import nl.taakhelden.family.ui.components.YoungSpeakButton
import nl.taakhelden.family.ui.theme.WDimens
import nl.taakhelden.family.ui.theme.WispelTheme
import nl.taakhelden.family.ui.theme.color
import java.util.concurrent.atomic.AtomicInteger

/**
 * "Mijn Ster": the child's own profile, level and avatar shop.
 *
 * This tab also carries the hidden parental gate entry points — a long press or a
 * five-tap. They are deliberately undiscoverable by accident, and exposed to screen
 * readers as an explicit custom action so the gate stays reachable without sight.
 */
@Composable
fun MijnSterTab(
    appState: AppState,
    viewModel: ChildViewModel,
) {
    val palette = WispelTheme.palette
    val isYoung = WispelTheme.isYoung
    val speechBus = appState.environment.speechBus
    val session by appState.authStore.childSessionFlow.collectAsState()
    val dayState by viewModel.day.state.collectAsState()

    val avatarShopState = viewModel.avatarShop?.state?.collectAsState()

    val avatar = session?.avatar ?: "🦊"
    val displayName = session?.displayName ?: stringResource(R.string.held_fallback_name)
    val gateAction = stringResource(R.string.held_parent_gate_action)

    val heroBalance = when (val current = dayState) {
        is ChildDayLoadState.Ready -> current.today.balance
        is ChildDayLoadState.EmptyAllDone -> current.balance
        else -> null
    }

    // Not observable state on purpose: counting taps must not recompose the tab.
    val tapCount = remember { AtomicInteger(0) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(WDimens.spacingXl)
            .combinedClickable(
                onClick = {
                    // Five taps in a row is the second hidden entry point (ADR-0003).
                    if (tapCount.incrementAndGet() >= FIVE_TAP_THRESHOLD) {
                        tapCount.set(0)
                        appState.openParentGate(ParentGateEntryPoint.BUILD_NUMBER_FIVE_TAP)
                    }
                },
                onLongClick = {
                    appState.openParentGate(ParentGateEntryPoint.HERO_WORDMARK_LONG_PRESS)
                },
            )
            .semantics {
                customActions = listOf(
                    CustomAccessibilityAction(gateAction) {
                        appState.openParentGate(ParentGateEntryPoint.HERO_WORDMARK_LONG_PRESS)
                        true
                    },
                )
            },
        verticalArrangement = Arrangement.spacedBy(WDimens.spacingLg),
    ) {
        WCard {
            Text(
                text = avatar,
                fontSize = if (isYoung) 72.sp else 56.sp,
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(WDimens.spacingSm),
            ) {
                Text(
                    text = displayName,
                    style = MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.Bold,
                    color = palette.text.color,
                )
                if (isYoung) YoungSpeakButton(text = displayName, speechBus = speechBus)
            }

            if (heroBalance != null) {
                val level = avatarShopState?.value?.memberState?.level
                    ?: HeroProgress.levelFromLifetime(heroBalance.lifetimeEarned)
                Text(
                    text = stringResource(R.string.held_level_format, level),
                    color = palette.mutedText.color,
                )
                Text(
                    text = stringResource(
                        R.string.held_lifetime_format,
                        heroBalance.lifetimeEarned,
                        heroBalance.streakDays,
                    ),
                    style = MaterialTheme.typography.bodyMedium,
                    color = palette.mutedText.color,
                )
            } else {
                Text(
                    text = stringResource(R.string.held_level_explain),
                    color = palette.mutedText.color,
                )
            }
        }

        viewModel.avatarShop?.let { store ->
            AvatarShopSection(
                store = store,
                baseAvatar = avatar,
                speechBus = speechBus,
            )
        }

        Text(
            text = stringResource(R.string.held_parent_gate_hint),
            style = MaterialTheme.typography.bodyMedium,
            color = palette.mutedText.color,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

private const val FIVE_TAP_THRESHOLD = 5
