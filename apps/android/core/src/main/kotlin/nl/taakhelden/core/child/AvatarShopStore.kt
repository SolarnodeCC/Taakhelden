package nl.taakhelden.core.child

import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import nl.taakhelden.core.api.AvatarCatalogItemDTO
import nl.taakhelden.core.api.MemberAvatarStateDTO
import nl.taakhelden.core.api.OptionalNullString
import nl.taakhelden.core.api.TaakHeldenApiClient
import java.util.UUID

public enum class AvatarSlotFilter(public val wire: String) {
    HAT("hat"),
    BACKGROUND("background"),
    ACCESSORY("accessory"),
}

public enum class AvatarShopError {
    LOAD_FAILED,
    EQUIP_FAILED,
}

public data class AvatarShopState(
    val catalog: List<AvatarCatalogItemDTO> = emptyList(),
    val memberState: MemberAvatarStateDTO? = null,
    val isLoading: Boolean = false,
    val isEquipping: Boolean = false,
    val error: AvatarShopError? = null,
    val selectedSlot: AvatarSlotFilter = AvatarSlotFilter.HAT,
) {
    public val itemsForSelectedSlot: List<AvatarCatalogItemDTO>
        get() = catalog.filter { it.slot == selectedSlot.wire }.sortedBy { it.sortOrder }
}

public class AvatarShopStore(
    private val apiClient: TaakHeldenApiClient,
    private val memberId: String,
) {
    private val _state = MutableStateFlow(AvatarShopState())
    public val state: StateFlow<AvatarShopState> = _state.asStateFlow()

    /**
     * Stable Idempotency-Key per equip intent, held until that equip succeeds.
     *
     * Equipping is a ledger-adjacent write; reusing the key means a retry after a dropped
     * response is deduplicated server-side instead of being applied twice.
     */
    private val pendingEquipKeys = mutableMapOf<String, String>()

    public fun selectSlot(slot: AvatarSlotFilter) {
        _state.value = _state.value.copy(selectedSlot = slot)
    }

    public suspend fun load(): Unit = coroutineScope {
        _state.value = _state.value.copy(isLoading = true, error = null)
        try {
            val catalogTask = async { apiClient.fetchAvatarCatalog() }
            val stateTask = async { apiClient.fetchMemberAvatar(memberId) }
            _state.value = _state.value.copy(
                catalog = catalogTask.await().items,
                memberState = stateTask.await(),
            )
        } catch (_: Exception) {
            _state.value = _state.value.copy(error = AvatarShopError.LOAD_FAILED)
        } finally {
            _state.value = _state.value.copy(isLoading = false)
        }
    }

    public fun isUnlocked(item: AvatarCatalogItemDTO): Boolean =
        _state.value.memberState?.unlocked?.contains(item.id) == true

    public fun isEquipped(item: AvatarCatalogItemDTO): Boolean {
        val equipped = _state.value.memberState?.equipped ?: return false
        return when (item.slot) {
            AvatarSlotFilter.HAT.wire -> equipped.hat == item.id
            AvatarSlotFilter.BACKGROUND.wire -> equipped.background == item.id
            AvatarSlotFilter.ACCESSORY.wire -> equipped.accessory == item.id
            else -> false
        }
    }

    public suspend fun equip(item: AvatarCatalogItemDTO) {
        if (!isUnlocked(item) || _state.value.isEquipping) return

        _state.value = _state.value.copy(isEquipping = true)
        val key = pendingEquipKeys.getOrPut(item.id) { UUID.randomUUID().toString() }

        try {
            val updated = when (item.slot) {
                AvatarSlotFilter.HAT.wire -> apiClient.equipAvatar(
                    memberId = memberId,
                    hat = OptionalNullString.Value(item.id),
                    idempotencyKey = key,
                )

                AvatarSlotFilter.BACKGROUND.wire -> apiClient.equipAvatar(
                    memberId = memberId,
                    background = OptionalNullString.Value(item.id),
                    idempotencyKey = key,
                )

                AvatarSlotFilter.ACCESSORY.wire -> apiClient.equipAvatar(
                    memberId = memberId,
                    accessory = OptionalNullString.Value(item.id),
                    idempotencyKey = key,
                )

                else -> return
            }
            pendingEquipKeys.remove(item.id)
            _state.value = _state.value.copy(memberState = updated, error = null)
        } catch (_: Exception) {
            _state.value = _state.value.copy(error = AvatarShopError.EQUIP_FAILED)
        } finally {
            _state.value = _state.value.copy(isEquipping = false)
        }
    }

    /** Test seam: the pending key for an item after a failed/incomplete equip. */
    public fun pendingKey(itemId: String): String? = pendingEquipKeys[itemId]
}
