package nl.taakhelden.core.api

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObjectBuilder
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.put

/**
 * Request bodies and the UI-facing models that sit beside the generated contract types.
 *
 * Split from [TaakHeldenApiClient] so the client file is the transport logic only. The
 * wire DTOs themselves stay in the generated `ContractModels.kt`.
 */

/** Distinguishes omit-vs-explicit-null for equip PATCH bodies. */
public sealed interface OptionalNullString {
    public data object Omit : OptionalNullString
    public data class Value(val value: String?) : OptionalNullString
}

internal fun JsonObjectBuilder.putSlot(key: String, slot: OptionalNullString) {
    when (slot) {
        is OptionalNullString.Omit -> Unit
        is OptionalNullString.Value -> put(key, slot.value?.let(::JsonPrimitive) ?: JsonNull)
    }
}

// MARK: - View-layer models (UI-friendly, distinct from transport DTOs)

public data class FamilyCodeLookup(
    val familyName: String,
    val children: List<ChildProfileSummary>,
)

public data class ChildProfileSummary(
    val id: String,
    val displayName: String,
    val avatar: String,
    val ageBand: nl.taakhelden.core.auth.ChildAgeBand,
)

public data class ChildPairingRequest(
    val familyCode: String,
    val childId: String,
    val pin: String,
    val ageBand: nl.taakhelden.core.auth.ChildAgeBand,
)

// MARK: - Request bodies

@Serializable
internal data class FamilyCodeBody(val familyCode: String)

@Serializable
internal data class ChildSessionBody(
    val familyCode: String,
    val childId: String,
    val pincode: String,
)

@Serializable
internal data class AppleAuthBody(
    val identityToken: String,
    val familyName: String? = null,
    val displayName: String? = null,
)

@Serializable
internal data class CreateChildBody(
    val displayName: String,
    val birthYear: Int,
    val avatarId: String,
    val pincode: String,
)

@Serializable
internal data class UploadIntentBody(
    val purpose: String,
    val instanceId: String,
    val contentType: String,
    val bytes: Int,
)

@Serializable
internal data class AttachPhotoBody(val photoId: String)

@Serializable
internal data class DeviceBody(val apnsToken: String, val platform: String)

@Serializable
internal data class RedoBody(val note: String)

@Serializable
internal data class DeleteAccountBody(val appleIdentityToken: String)

@Serializable
internal data class CreateProposalBody(
    val title: String,
    val category: String,
    val suggestedPoints: Int,
    val note: String? = null,
)

/** Extracted so tests can assert the upload without spinning up a real R2 endpoint. */
public interface PhotoUploading {
    public suspend fun upload(uploadUrl: String, data: ByteArray, contentType: String)
}
