package nl.taakhelden.core.api

import nl.taakhelden.core.i18n.LocalisedFailure
import nl.taakhelden.core.i18n.UserMessage
import java.util.UUID

/**
 * Mirrors `APIClientError` on iOS.
 *
 * These are singletons, so call sites can compare with `is` / referential equality the
 * same way the Swift enum cases are matched.
 */
public sealed class ApiClientException(
    public val userMessage: UserMessage,
) : Exception(userMessage.name) {

    public val failure: LocalisedFailure get() = LocalisedFailure(userMessage)

    public object InvalidFamilyCode : ApiClientException(UserMessage.INVALID_FAMILY_CODE)

    public object InvalidPin : ApiClientException(UserMessage.INVALID_PIN)

    public object InvalidParentNote : ApiClientException(UserMessage.INVALID_PARENT_NOTE)

    public object SessionMissing : ApiClientException(UserMessage.SESSION_MISSING)

    public object ParentSessionMissing : ApiClientException(UserMessage.PARENT_SESSION_MISSING)

    public object ParentReauthRequired : ApiClientException(UserMessage.PARENT_REAUTH_REQUIRED)

    public object NotImplemented : ApiClientException(UserMessage.NOT_IMPLEMENTED)
}

/**
 * Deterministic idempotency keys for ledger-affecting mutations.
 *
 * Architecture rule 2: a retry must never mint a fresh key for the same intent, or a
 * dropped response turns into a double award. Approve/redo/archive derive their key from
 * the target id; create flows mint one key per user intent and reuse it across retries.
 */
public object IdempotencyKey {
    public fun forApproval(instanceId: String): String = "approve-$instanceId"

    public fun forRedo(instanceId: String): String = "redo-$instanceId"

    public fun forTaskArchive(taskId: String): String = "archive-task-$taskId"

    public fun forRewardArchive(rewardId: String): String = "archive-reward-$rewardId"

    public fun forTaskCreate(): String = "task-create-${UUID.randomUUID()}"

    public fun forRewardCreate(): String = "reward-create-${UUID.randomUUID()}"
}
