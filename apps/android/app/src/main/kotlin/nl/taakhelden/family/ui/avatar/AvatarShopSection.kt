package nl.taakhelden.family.ui.avatar

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import nl.taakhelden.core.api.AvatarCatalogItemDTO
import nl.taakhelden.core.child.AvatarShopError
import nl.taakhelden.core.child.AvatarShopStore
import nl.taakhelden.core.child.AvatarSlotFilter
import nl.taakhelden.family.R
import nl.taakhelden.family.platform.SpeechBus
import nl.taakhelden.family.ui.components.WCard
import nl.taakhelden.family.ui.components.WPrimaryButton
import nl.taakhelden.family.ui.components.WSecondaryButton
import nl.taakhelden.family.ui.components.YoungSpeakButton
import nl.taakhelden.family.ui.theme.WDimens
import nl.taakhelden.family.ui.theme.WispelTheme
import nl.taakhelden.family.ui.theme.color

/**
 * Avatar shop.
 *
 * Locked items stay visible with an encouraging "how far to go" line rather than being
 * hidden or crossed out — the whole point is that they read as something to work toward.
 */
@Composable
fun AvatarShopSection(
    store: AvatarShopStore,
    baseAvatar: String,
    speechBus: SpeechBus,
    modifier: Modifier = Modifier,
) {
    val palette = WispelTheme.palette
    val isYoung = WispelTheme.isYoung
    val scope = rememberCoroutineScope()
    val state by store.state.collectAsState()

    LaunchedEffect(store) { store.load() }

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(WDimens.spacingLg),
    ) {
        WCard {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(WDimens.spacingMd),
            ) {
                Text(
                    text = composedEmoji(state.memberState, state.catalog, baseAvatar),
                    fontSize = if (isYoung) 72.sp else 56.sp,
                    modifier = Modifier.clearAndSetSemantics { },
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.held_avatar_title),
                        style = MaterialTheme.typography.titleMedium,
                        color = palette.text.color,
                    )
                    state.memberState?.let { member ->
                        Text(
                            text = stringResource(R.string.held_level_format, member.level),
                            color = palette.mutedText.color,
                        )
                    }
                }
                if (isYoung) {
                    state.memberState?.let { member ->
                        YoungSpeakButton(
                            text = stringResource(R.string.held_level_speak, member.level),
                            speechBus = speechBus,
                        )
                    }
                }
            }
        }

        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            AvatarSlotFilter.entries.forEachIndexed { index, slot ->
                SegmentedButton(
                    selected = state.selectedSlot == slot,
                    onClick = { store.selectSlot(slot) },
                    shape = SegmentedButtonDefaults.itemShape(
                        index = index,
                        count = AvatarSlotFilter.entries.size,
                    ),
                ) {
                    Text(
                        text = stringResource(
                            when (slot) {
                                AvatarSlotFilter.HAT -> R.string.held_avatar_slot_hat
                                AvatarSlotFilter.BACKGROUND -> R.string.held_avatar_slot_background
                                AvatarSlotFilter.ACCESSORY -> R.string.held_avatar_slot_accessory
                            },
                        ),
                    )
                }
            }
        }

        when {
            state.isLoading -> Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(WDimens.spacingMd),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CircularProgressIndicator(color = palette.accent.color)
                Text(
                    text = stringResource(R.string.held_avatar_loading),
                    color = palette.mutedText.color,
                )
            }

            state.error == AvatarShopError.LOAD_FAILED && state.catalog.isEmpty() -> Column(
                verticalArrangement = Arrangement.spacedBy(WDimens.spacingSm),
            ) {
                Text(
                    text = stringResource(R.string.held_avatar_load_error),
                    color = palette.mutedText.color,
                )
                WSecondaryButton(
                    text = stringResource(R.string.child_retry),
                    onClick = { scope.launch { store.load() } },
                )
            }

            else -> {
                if (state.error == AvatarShopError.EQUIP_FAILED) {
                    Text(
                        text = stringResource(R.string.held_avatar_equip_error),
                        color = palette.mutedText.color,
                    )
                }
                state.itemsForSelectedSlot.forEach { item ->
                    AvatarItemRow(
                        item = item,
                        isUnlocked = store.isUnlocked(item),
                        isEquipped = store.isEquipped(item),
                        isEquipping = state.isEquipping,
                        onEquip = { scope.launch { store.equip(item) } },
                    )
                }
            }
        }
    }
}

@Composable
private fun AvatarItemRow(
    item: AvatarCatalogItemDTO,
    isUnlocked: Boolean,
    isEquipped: Boolean,
    isEquipping: Boolean,
    onEquip: () -> Unit,
) {
    val palette = WispelTheme.palette
    val isYoung = WispelTheme.isYoung

    WCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(WDimens.spacingMd),
        ) {
            Text(
                text = item.previewEmoji,
                fontSize = if (isYoung) 40.sp else 28.sp,
                modifier = Modifier.clearAndSetSemantics { },
            )
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(WDimens.spacingXs),
            ) {
                Text(text = item.title, color = palette.text.color)
                Text(
                    text = if (isUnlocked) {
                        stringResource(R.string.held_avatar_unlocked)
                    } else {
                        unlockHint(item)
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = palette.mutedText.color,
                )
            }
            if (isUnlocked) {
                WPrimaryButton(
                    text = stringResource(
                        if (isEquipped) R.string.held_avatar_equipped else R.string.held_avatar_equip,
                    ),
                    onClick = onEquip,
                    enabled = !isEquipped && !isEquipping,
                )
            }
        }
    }
}

@Composable
private fun unlockHint(item: AvatarCatalogItemDTO): String = when (item.unlockType) {
    "level" -> stringResource(R.string.held_avatar_unlock_level, item.unlockThreshold)
    "lifetimePoints" -> stringResource(R.string.held_avatar_unlock_points, item.unlockThreshold)
    "badge" -> stringResource(R.string.held_avatar_unlock_badge)
    else -> stringResource(R.string.held_avatar_unlock_soon)
}

/** Composes hat + base avatar + accessory into one glyph string for the preview. */
private fun composedEmoji(
    memberState: nl.taakhelden.core.api.MemberAvatarStateDTO?,
    catalog: List<AvatarCatalogItemDTO>,
    baseAvatar: String,
): String {
    val state = memberState ?: return baseAvatar
    fun emojiFor(id: String?) = id?.let { value ->
        catalog.firstOrNull { it.id == value }?.previewEmoji
    }
    return listOfNotNull(
        emojiFor(state.equipped.hat),
        baseAvatar,
        emojiFor(state.equipped.accessory),
    ).joinToString(separator = "")
}
