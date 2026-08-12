package nl.taakhelden.core.api

import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray

/**
 * The parent-only half of the API surface.
 *
 * Split out of [TaakHeldenApiClient] for the same reason iOS keeps
 * `ParentHTTPMethods.swift` separate: these endpoints must never be reached with a child
 * token, so having them in one file makes that rule reviewable at a glance. They are
 * extensions rather than members precisely so they all have to go through
 * [TaakHeldenApiClient.sendAsParent].
 */

public suspend fun TaakHeldenApiClient.fetchParentToday(): ParentTodayViewDTO {
    val response = sendAsParent(
        HttpRequest(
            path = "/instances/today",
            method = HttpMethod.GET,
            requiresAuth = true,
            requiresContractV2 = true,
        ),
    )
    return decode(ParentTodayViewDTO.serializer(), response.body)
}

public suspend fun TaakHeldenApiClient.approveInstance(id: String, idempotencyKey: String) {
    sendAsParent(
        HttpRequest(
            path = "/instances/$id/approve",
            method = HttpMethod.POST,
            requiresAuth = true,
            idempotencyKey = idempotencyKey,
        ),
    )
}

public suspend fun TaakHeldenApiClient.redoInstance(id: String, note: String, idempotencyKey: String) {
    val body = apiJson.encodeToString(RedoBody.serializer(), RedoBody(note))
    sendAsParent(
        HttpRequest(
            path = "/instances/$id/redo",
            method = HttpMethod.POST,
            body = body,
            requiresAuth = true,
            idempotencyKey = idempotencyKey,
        ),
    )
}

public suspend fun TaakHeldenApiClient.fetchParentTasks(): List<ParentTaskManageDTO> {
    val response = sendAsParent(
        HttpRequest(path = "/tasks", method = HttpMethod.GET, requiresAuth = true),
    )
    return decode(ListSerializer(ParentTaskManageDTO.serializer()), response.body)
}

public suspend fun TaakHeldenApiClient.createTask(
    title: String,
    points: Int,
    assignees: List<String>,
    idempotencyKey: String,
): ParentTaskManageDTO {
    val payload = buildJsonObject {
        put("title", title)
        put("points", points)
        putJsonArray("assignees") { assignees.forEach { add(JsonPrimitive(it)) } }
        put("category", "household")
        put("icon", "star")
    }
    val response = sendAsParent(
        HttpRequest(
            path = "/tasks",
            method = HttpMethod.POST,
            body = payload.toString(),
            requiresAuth = true,
            idempotencyKey = idempotencyKey,
        ),
    )
    return decode(ParentTaskManageDTO.serializer(), response.body)
}

public suspend fun TaakHeldenApiClient.archiveTask(id: String) {
    sendAsParent(
        HttpRequest(
            path = "/tasks/$id",
            method = HttpMethod.DELETE,
            requiresAuth = true,
            idempotencyKey = IdempotencyKey.forTaskArchive(id),
        ),
    )
}

public suspend fun TaakHeldenApiClient.fetchParentRewards(): List<ParentRewardManageDTO> {
    val response = sendAsParent(
        HttpRequest(
            path = "/rewards",
            method = HttpMethod.GET,
            requiresAuth = true,
            requiresContractV2 = true,
        ),
    )
    // The v2 contract wraps rewards in a viewer envelope; older shapes return a bare
    // array. Accept both so a contract rollout never blanks the rewards tab.
    return runCatching {
        decode(ParentRewardsViewDTO.serializer(), response.body).rewards
    }.getOrElse {
        decode(ListSerializer(ParentRewardManageDTO.serializer()), response.body)
    }
}

public suspend fun TaakHeldenApiClient.createReward(
    title: String,
    price: Int,
    idempotencyKey: String,
): ParentRewardManageDTO {
    val payload = buildJsonObject {
        put("title", title)
        put("price", price)
        put("icon", "gift")
    }
    val response = sendAsParent(
        HttpRequest(
            path = "/rewards",
            method = HttpMethod.POST,
            body = payload.toString(),
            requiresAuth = true,
            idempotencyKey = idempotencyKey,
        ),
    )
    return decode(ParentRewardManageDTO.serializer(), response.body)
}

public suspend fun TaakHeldenApiClient.archiveReward(id: String) {
    sendAsParent(
        HttpRequest(
            path = "/rewards/$id",
            method = HttpMethod.DELETE,
            requiresAuth = true,
            idempotencyKey = IdempotencyKey.forRewardArchive(id),
        ),
    )
}

public suspend fun TaakHeldenApiClient.mintFamilyRoomToken(): WsTokenDTO {
    val response = sendAsParent(
        HttpRequest(path = "/ws/token", method = HttpMethod.POST, requiresAuth = true),
    )
    return decode(WsTokenDTO.serializer(), response.body)
}

public suspend fun TaakHeldenApiClient.startAccountExport(): ExportJobDTO {
    val response = sendAsParent(
        HttpRequest(path = "/account/export", method = HttpMethod.POST, requiresAuth = true),
    )
    return decode(ExportJobDTO.serializer(), response.body)
}

public suspend fun TaakHeldenApiClient.fetchAccountExport(id: String): ExportJobDTO {
    val response = sendAsParent(
        HttpRequest(
            path = "/account/export/$id",
            method = HttpMethod.GET,
            requiresAuth = true,
        ),
    )
    return decode(ExportJobDTO.serializer(), response.body)
}

public suspend fun TaakHeldenApiClient.deleteAccount(appleIdentityToken: String): AccountDeleteResultDTO {
    val body = apiJson.encodeToString(
        DeleteAccountBody.serializer(),
        DeleteAccountBody(appleIdentityToken),
    )
    val response = sendAsParent(
        HttpRequest(
            path = "/account",
            method = HttpMethod.DELETE,
            body = body,
            requiresAuth = true,
        ),
    )
    return decode(AccountDeleteResultDTO.serializer(), response.body)
}

