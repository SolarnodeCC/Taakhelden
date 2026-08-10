package nl.taakhelden.family.ui

import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import nl.taakhelden.core.api.ApiClientException
import nl.taakhelden.core.api.HttpTransportException
import nl.taakhelden.core.i18n.LocalisedFailure
import nl.taakhelden.core.i18n.UserMessage
import nl.taakhelden.core.sync.PhotoBonusException
import nl.taakhelden.family.R

/**
 * Resolves a core [UserMessage] to a localised string.
 *
 * The core module raises symbols instead of copy so that every user-facing sentence lives
 * in the string catalogs where translators and the child-copy review lane can find it.
 * This mapping is the one place the two meet.
 */
@StringRes
fun UserMessage.stringRes(): Int = when (this) {
    UserMessage.INVALID_FAMILY_CODE -> R.string.error_invalid_family_code
    UserMessage.INVALID_PIN -> R.string.error_invalid_pin
    UserMessage.INVALID_PARENT_NOTE -> R.string.error_invalid_parent_note
    UserMessage.SESSION_MISSING -> R.string.error_session_missing
    UserMessage.PARENT_SESSION_MISSING -> R.string.error_parent_session_missing
    UserMessage.PARENT_REAUTH_REQUIRED -> R.string.error_parent_reauth_required
    UserMessage.NOT_IMPLEMENTED -> R.string.error_not_implemented
    UserMessage.TRANSPORT_INVALID_URL -> R.string.error_transport_invalid_url
    UserMessage.TRANSPORT_OFFLINE -> R.string.error_transport_offline
    UserMessage.TRANSPORT_GENERIC -> R.string.error_transport_generic
    UserMessage.TRANSPORT_DECODING -> R.string.error_transport_decoding
    UserMessage.PHOTO_PROCESSING_FAILED -> R.string.error_photo_processing_failed
    UserMessage.PHOTO_PROCESSING_TIMEOUT -> R.string.error_photo_processing_timeout
    UserMessage.BIOMETRICS_UNAVAILABLE -> R.string.error_biometrics_unavailable
    UserMessage.BIOMETRICS_CANCELLED -> R.string.error_biometrics_cancelled
    UserMessage.APPLE_SIGN_IN_FAILED -> R.string.error_apple_sign_in_failed
    UserMessage.PARENT_TASKS_NEED_CHILD -> R.string.parent_tasks_need_child
}

@Composable
fun UserMessage.text(): String = stringResource(stringRes())

/**
 * Prefers the server's own message when the API sent one.
 *
 * The Worker already speaks Dutch and knows more about *why* a call failed than the
 * client does, so its message beats our generic fallback whenever it exists.
 */
@Composable
fun LocalisedFailure.text(): String = serverMessage ?: stringResource(message.stringRes())

/**
 * Turns any throwable from the core layer into something showable.
 *
 * Anything we do not recognise becomes the generic "something went wrong" line rather
 * than a raw exception message: those leak internals and are never in the user's
 * language.
 */
fun failureOf(throwable: Throwable): LocalisedFailure = when (throwable) {
    is ApiClientException -> throwable.failure
    is HttpTransportException -> throwable.failure
    is PhotoBonusException -> LocalisedFailure(throwable.userMessage)
    else -> LocalisedFailure(UserMessage.TRANSPORT_GENERIC)
}
