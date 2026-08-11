package nl.taakhelden.core.api

import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObjectBuilder
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import nl.taakhelden.core.auth.AuthStore
import nl.taakhelden.core.auth.ChildSession
import nl.taakhelden.core.designsystem.AvatarCatalog

/**
 * The single HTTP surface both the child and the parent side of the app talk to.
 *
 * Token selection is deliberate and mirrors iOS:
 *  - [sendAsChild] uses the child token and refreshes it on 401.
 *  - [sendAsParent] uses the parent token and refreshes it on 401.
 *  - [sendAuthorized] prefers the child token when a child is paired (the child home
 *    path), otherwise falls back to the parent token. Parent-only endpoints must call
 *    [sendAsParent] directly, never this.
 */
public class TaakHeldenApiClient(
    public val transport: HttpTransporting,
    public val authStore: AuthStore,
    private val refreshCoordinator: TokenRefreshCoordinator = TokenRefreshCoordinator(),
    private val photoUploader: PhotoUploading = OkHttpPhotoUploader(),
) {

    // MARK: - Public auth

    public suspend fun resolveFamilyCode(code: String): FamilyCodeLookup {
        val body = apiJson.encodeToString(
            FamilyCodeBody.serializer(),
            FamilyCodeBody(familyCode = code),
        )
        val response = transport.send(
            HttpRequest(path = "/auth/family-code", method = HttpMethod.POST, body = body),
            accessToken = null,
        )
        val dto = decode(FamilyCodeResultDTO.serializer(), response.body)
        return FamilyCodeLookup(
            familyName = dto.familyName,
            children = dto.children.map { child ->
                ChildProfileSummary(
                    id = child.id,
                    displayName = child.displayName,
                    avatar = AvatarCatalog.emojiFor(child.avatarId),
                    ageBand = AvatarCatalog.ageBandFrom(child.ageMode),
                )
            },
        )
    }

    public suspend fun pairChild(request: ChildPairingRequest): ChildSession {
        val body = apiJson.encodeToString(
            ChildSessionBody.serializer(),
            ChildSessionBody(
                familyCode = request.familyCode,
                childId = request.childId,
                pincode = request.pin,
            ),
        )
        val response = transport.send(
            HttpRequest(path = "/auth/child-session", method = HttpMethod.POST, body = body),
            accessToken = null,
        )
        return mapChildSession(decode(ChildSessionResultDTO.serializer(), response.body))
    }

    public suspend fun refreshChildSession(): ChildSession {
        val refreshToken = authStore.childSession?.refreshToken
            ?: throw ApiClientException.SessionMissing
        val dto = refreshCoordinator.refreshChild(refreshToken, transport)
        val session = mapChildSession(dto)
        authStore.updateChildTokens(session.accessToken, session.refreshToken)
        return session
    }

    /**
     * Exchanges an Apple identity token for a parent session.
     *
     * On Android the identity token comes from Apple's web authorization flow rather than
     * the native `ASAuthorizationController`; the Worker verifies it identically either
     * way, so this endpoint is unchanged from iOS.
     */
    public suspend fun signInWithApple(
        identityToken: String,
        familyName: String?,
        displayName: String?,
    ): nl.taakhelden.core.auth.ParentSession {
        val body = apiJson.encodeToString(
            AppleAuthBody.serializer(),
            AppleAuthBody(
                identityToken = identityToken,
                familyName = familyName,
                displayName = displayName,
            ),
        )
        val response = transport.send(
            HttpRequest(path = "/auth/apple", method = HttpMethod.POST, body = body),
            accessToken = null,
        )
        val dto = decode(ParentSessionResultDTO.serializer(), response.body)
        return nl.taakhelden.core.auth.ParentSession(
            accessToken = dto.accessToken,
            refreshToken = dto.refreshToken,
            familyId = dto.familyId,
            userId = dto.userId,
        )
    }

    public suspend fun createChild(
        displayName: String,
        birthYear: Int,
        avatarId: String,
        pin: String,
    ): MemberViewDTO {
        val body = apiJson.encodeToString(
            CreateChildBody.serializer(),
            CreateChildBody(
                displayName = displayName,
                birthYear = birthYear,
                avatarId = avatarId,
                pincode = pin,
            ),
        )
        val response = sendAsParent(
            HttpRequest(
                path = "/members/children",
                method = HttpMethod.POST,
                body = body,
                requiresAuth = true,
            ),
        )
        return decode(MemberViewDTO.serializer(), response.body)
    }

    public suspend fun fetchParentFamily(): ParentFamilyViewDTO {
        val response = sendAsParent(
            HttpRequest(
                path = "/families/me",
                method = HttpMethod.GET,
                requiresAuth = true,
                requiresContractV2 = true,
            ),
        )
        return decode(ParentFamilyViewDTO.serializer(), response.body)
    }

    // MARK: - Child reads

    public suspend fun fetchChildToday(): ChildTodayViewDTO {
        val response = sendAuthorized(
            HttpRequest(
                path = "/instances/today",
                method = HttpMethod.GET,
                requiresAuth = true,
                requiresContractV2 = true,
            ),
        )
        return decode(ChildTodayViewDTO.serializer(), response.body)
    }

    public suspend fun fetchChildRewards(): ChildRewardsViewDTO {
        val response = sendAuthorized(
            HttpRequest(
                path = "/rewards",
                method = HttpMethod.GET,
                requiresAuth = true,
                requiresContractV2 = true,
            ),
        )
        return decode(ChildRewardsViewDTO.serializer(), response.body)
    }

    public suspend fun fetchChildRedemptions(): ChildRedemptionsViewDTO {
        val response = sendAuthorized(
            HttpRequest(
                path = "/redemptions",
                method = HttpMethod.GET,
                requiresAuth = true,
                requiresContractV2 = true,
            ),
        )
        return decode(ChildRedemptionsViewDTO.serializer(), response.body)
    }

    // MARK: - Mutations

    public suspend fun completeInstance(id: String, idempotencyKey: String): CompleteResultDTO {
        val response = sendAuthorized(
            HttpRequest(
                path = "/instances/$id/complete",
                method = HttpMethod.POST,
                requiresAuth = true,
                idempotencyKey = idempotencyKey,
            ),
        )
        return decode(CompleteResultDTO.serializer(), response.body)
    }

    public suspend fun redeemReward(id: String, idempotencyKey: String): RedeemResultDTO {
        val response = sendAuthorized(
            HttpRequest(
                path = "/rewards/$id/redeem",
                method = HttpMethod.POST,
                requiresAuth = true,
                idempotencyKey = idempotencyKey,
            ),
        )
        return decode(RedeemResultDTO.serializer(), response.body)
    }

    /** Pins a reward as the child's spaardoel (online-only; not a sync mutation). */
    public suspend fun pinReward(id: String): PinRewardResultDTO {
        val response = sendAuthorized(
            HttpRequest(path = "/rewards/$id/pin", method = HttpMethod.POST, requiresAuth = true),
        )
        return decode(PinRewardResultDTO.serializer(), response.body)
    }

    public suspend fun sync(since: String?, mutations: List<SyncMutationDTO>): SyncResponseDTO {
        val body = apiJson.encodeToString(
            SyncBodyDTO.serializer(),
            SyncBodyDTO(since = since, mutations = mutations),
        )
        val response = sendAuthorized(
            HttpRequest(path = "/sync", method = HttpMethod.POST, body = body, requiresAuth = true),
        )
        return decode(SyncResponseDTO.serializer(), response.body)
    }

    // MARK: - Photos

    public suspend fun createUploadIntent(
        instanceId: String,
        contentType: String,
        bytes: Int,
    ): UploadIntentResponseDTO {
        val body = apiJson.encodeToString(
            UploadIntentBody.serializer(),
            UploadIntentBody(
                purpose = "task",
                instanceId = instanceId,
                contentType = contentType,
                bytes = bytes,
            ),
        )
        val response = sendAuthorized(
            HttpRequest(
                path = "/photos/upload-intent",
                method = HttpMethod.POST,
                body = body,
                requiresAuth = true,
            ),
        )
        return decode(UploadIntentResponseDTO.serializer(), response.body)
    }

    /** PUTs the raw JPEG to the presigned R2 URL. Never log this URL (privacy rule 5). */
    public suspend fun uploadPhoto(uploadUrl: String, data: ByteArray, contentType: String) {
        photoUploader.upload(uploadUrl, data, contentType)
    }

    public suspend fun confirmPhoto(photoId: String): PhotoStatusResponseDTO {
        val response = sendAuthorized(
            HttpRequest(
                path = "/photos/$photoId/confirm",
                method = HttpMethod.POST,
                requiresAuth = true,
            ),
        )
        return decode(PhotoStatusResponseDTO.serializer(), response.body)
    }

    public suspend fun fetchPhotoStatus(photoId: String): PhotoStatusResponseDTO {
        val response = sendAuthorized(
            HttpRequest(path = "/photos/$photoId", method = HttpMethod.GET, requiresAuth = true),
        )
        return decode(PhotoStatusResponseDTO.serializer(), response.body)
    }

    public suspend fun attachPhoto(instanceId: String, photoId: String): CompleteResultDTO {
        val body = apiJson.encodeToString(
            AttachPhotoBody.serializer(),
            AttachPhotoBody(photoId),
        )
        val response = sendAuthorized(
            HttpRequest(
                path = "/instances/$instanceId/photo",
                method = HttpMethod.POST,
                body = body,
                requiresAuth = true,
            ),
        )
        return decode(CompleteResultDTO.serializer(), response.body)
    }

    /**
     * Registers this device's FCM token for push.
     *
     * The field is named `apnsToken` for historical reasons — the shared `DeviceBody`
     * schema carries the registration token for both gateways and routes on `platform`.
     */
    public suspend fun registerDevice(fcmToken: String) {
        val body = apiJson.encodeToString(
            DeviceBody.serializer(),
            DeviceBody(apnsToken = fcmToken, platform = "android"),
        )
        sendAuthorized(
            HttpRequest(path = "/devices", method = HttpMethod.POST, body = body, requiresAuth = true),
        )
    }

    /**
     * Removes the (token, user_id) device registration for the **current** session user.
     * On a shared tablet only the departing profile's row is deleted; other profiles are
     * unaffected.
     */
    public suspend fun deregisterDevice(fcmToken: String) {
        sendAuthorized(
            HttpRequest(
                path = "/devices/$fcmToken",
                method = HttpMethod.DELETE,
                requiresAuth = true,
            ),
        )
    }

    // MARK: - WS-PAUSE: per-child rest state (v1 read-only)

    /**
     * Fetches the active pause for the signed-in child.
     * Returns `null` when no pause is active today (404, or no active pause in the list).
     * Matches the WS-PAUSE contract (`GET /members/:id/pause` → `{ pauses: [...] }`).
     */
    public suspend fun fetchChildPause(memberId: String): ChildPauseDTO? = try {
        val response = sendAuthorized(
            HttpRequest(
                path = "/members/$memberId/pause",
                method = HttpMethod.GET,
                requiresAuth = true,
            ),
        )
        decode(ChildPauseResponseDTO.serializer(), response.body).pauses.firstOrNull { it.active }
    } catch (error: HttpTransportException.HttpStatus) {
        if (error.statusCode == 404) null else throw error
    }

    // MARK: - WS-PROPOSAL: teen task proposals

    /**
     * Creates a task proposal for a teen child.
     * The idempotency key must be stable across retries for the same proposal intent.
     */
    public suspend fun createTaskProposal(
        title: String,
        category: String,
        suggestedPoints: Int,
        note: String?,
        idempotencyKey: String,
    ): TaskProposalDTO {
        val body = apiJson.encodeToString(
            CreateProposalBody.serializer(),
            CreateProposalBody(
                title = title,
                category = category,
                suggestedPoints = suggestedPoints,
                note = note,
            ),
        )
        val response = sendAuthorized(
            HttpRequest(
                path = "/tasks/proposals",
                method = HttpMethod.POST,
                body = body,
                requiresAuth = true,
                idempotencyKey = idempotencyKey,
            ),
        )
        return decode(TaskProposalDTO.serializer(), response.body)
    }

    /** Returns the teen's own proposals (child token) or all pending ones (parent token). */
    public suspend fun fetchTaskProposals(status: String? = null): List<TaskProposalDTO> {
        val path = if (status != null) "/tasks/proposals?status=$status" else "/tasks/proposals"
        val response = sendAuthorized(
            HttpRequest(path = path, method = HttpMethod.GET, requiresAuth = true),
        )
        return decode(TaskProposalListDTO.serializer(), response.body).proposals
    }

    // MARK: - Avatar shop + family goals

    public suspend fun fetchAvatarCatalog(): AvatarCatalogResponseDTO {
        val response = sendAuthorized(
            HttpRequest(path = "/avatar/catalog", method = HttpMethod.GET, requiresAuth = true),
        )
        return decode(AvatarCatalogResponseDTO.serializer(), response.body)
    }

    public suspend fun fetchMemberAvatar(memberId: String): MemberAvatarStateDTO {
        val response = sendAuthorized(
            HttpRequest(
                path = "/members/$memberId/avatar",
                method = HttpMethod.GET,
                requiresAuth = true,
            ),
        )
        return decode(MemberAvatarStateDTO.serializer(), response.body)
    }

    /**
     * Equips avatar slots.
     *
     * [OptionalNullString] distinguishes "leave this slot alone" (omit the key) from
     * "clear this slot" (send an explicit null) — a plain nullable String cannot express
     * both, and the PATCH semantics depend on it.
     */
    public suspend fun equipAvatar(
        memberId: String,
        hat: OptionalNullString = OptionalNullString.Omit,
        background: OptionalNullString = OptionalNullString.Omit,
        accessory: OptionalNullString = OptionalNullString.Omit,
        idempotencyKey: String,
    ): MemberAvatarStateDTO {
        val payload = buildJsonObject {
            putSlot("hat", hat)
            putSlot("background", background)
            putSlot("accessory", accessory)
        }
        val response = sendAuthorized(
            HttpRequest(
                path = "/members/$memberId/avatar",
                method = HttpMethod.PATCH,
                body = payload.toString(),
                requiresAuth = true,
                idempotencyKey = idempotencyKey,
            ),
        )
        return decode(MemberAvatarStateDTO.serializer(), response.body)
    }

    public suspend fun fetchActiveFamilyGoalProgress(): FamilyGoalProgressResponseDTO {
        val response = sendAuthorized(
            HttpRequest(
                path = "/families/me/goals/active/progress",
                method = HttpMethod.GET,
                requiresAuth = true,
            ),
        )
        return decode(FamilyGoalProgressResponseDTO.serializer(), response.body)
    }

    public suspend fun createFamilyGoal(
        title: String,
        icon: String,
        targetPoints: Int,
        childIds: List<String>,
        idempotencyKey: String,
    ): FamilyGoalDTO {
        val payload = buildJsonObject {
            put("title", title)
            put("icon", icon)
            put("targetPoints", targetPoints)
            putJsonArray("childIds") { childIds.forEach { add(JsonPrimitive(it)) } }
        }
        val response = sendAsParent(
            HttpRequest(
                path = "/families/me/goals",
                method = HttpMethod.POST,
                body = payload.toString(),
                requiresAuth = true,
                idempotencyKey = idempotencyKey,
            ),
        )
        return decode(FamilyGoalDTO.serializer(), response.body)
    }

    // MARK: - Internals

    /** Child-session token only. Parent operations must use [sendAsParent]. */
    public suspend fun sendAsChild(request: HttpRequest, retried: Boolean = false): HttpResponse {
        val token = authStore.childSession?.accessToken ?: throw ApiClientException.SessionMissing
        return try {
            transport.send(request, token)
        } catch (error: HttpTransportException.HttpStatus) {
            if (error.statusCode == 401 && !retried) {
                refreshChildSession()
                sendAsChild(request, retried = true)
            } else {
                throw error
            }
        }
    }

    public suspend fun sendAsParent(request: HttpRequest, retried: Boolean = false): HttpResponse {
        val token = authStore.parentSession?.accessToken
            ?: throw ApiClientException.ParentSessionMissing
        return try {
            transport.send(request, token)
        } catch (error: HttpTransportException.HttpStatus) {
            if (error.statusCode == 401 && !retried) {
                val parentRefresh = authStore.parentSession?.refreshToken
                    ?: throw ApiClientException.ParentSessionMissing
                val dto = refreshCoordinator.refreshParent(parentRefresh, transport)
                authStore.updateParentTokens(dto.accessToken, dto.refreshToken)
                sendAsParent(request, retried = true)
            } else {
                throw error
            }
        }
    }

    /**
     * Prefers the child token when one is present (child home path); otherwise parent.
     * Do not use for parent-only endpoints — use [sendAsParent].
     */
    private suspend fun sendAuthorized(
        request: HttpRequest,
        retried: Boolean = false,
    ): HttpResponse =
        if (authStore.childSession != null) {
            sendAsChild(request, retried)
        } else {
            sendAsParent(request, retried)
        }

    /** Internal so the parent-only extensions in `ParentHttpMethods.kt` can share it. */
    internal fun <T> decode(serializer: KSerializer<T>, body: String): T = try {
        apiJson.decodeFromString(serializer, body)
    } catch (error: Exception) {
        throw HttpTransportException.Decoding(error)
    }

    private fun mapChildSession(dto: ChildSessionResultDTO): ChildSession = ChildSession(
        childId = dto.child.id,
        displayName = dto.child.displayName,
        avatar = AvatarCatalog.emojiFor(dto.child.avatarId),
        ageBand = AvatarCatalog.ageBandFrom(dto.child.ageMode),
        accessToken = dto.accessToken,
        refreshToken = dto.refreshToken,
    )
}
