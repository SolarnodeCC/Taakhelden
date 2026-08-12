package nl.taakhelden.core.i18n

/**
 * Localisable messages the core layer can raise.
 *
 * The core module has no access to Android resources, and hard-coding Dutch copy here
 * would put user-facing strings outside the `res/values` string catalogs where
 * translators and the `@dutch-child-copy` review lane look for them. So core raises a
 * symbol, and the Compose layer resolves it to a localised string.
 *
 * The iOS app embeds the Dutch copy directly in `APIClientError`/`HTTPTransportError`;
 * these entries are the one-to-one counterparts of those cases.
 */
public enum class UserMessage {
    /** iOS: "Die gezinscode lijkt nog niet compleet." */
    INVALID_FAMILY_CODE,

    /** iOS: "Die pincode mist nog een paar cijfers." */
    INVALID_PIN,

    /** iOS: "Schrijf nog even een korte, positieve notitie." */
    INVALID_PARENT_NOTE,

    /** iOS: "Je sessie is verlopen. Koppel dit toestel opnieuw." */
    SESSION_MISSING,

    /** iOS: "Log even in met je ouderaccount om goed te keuren of te beheren." */
    PARENT_SESSION_MISSING,

    /** iOS: "Bevestig opnieuw met Apple om het account te verwijderen." */
    PARENT_REAUTH_REQUIRED,

    /** iOS: "Deze actie is nog niet beschikbaar op dit toestel." */
    NOT_IMPLEMENTED,

    /** iOS: "De verbinding kon niet worden opgezet." */
    TRANSPORT_INVALID_URL,

    /** iOS: "We kunnen even geen verbinding maken — je afgevinkte taken zijn veilig." */
    TRANSPORT_OFFLINE,

    /** iOS: "Er ging iets mis. Probeer het gerust opnieuw." */
    TRANSPORT_GENERIC,

    /** iOS: "Het antwoord was onverwacht. Probeer het zo nog een keer." */
    TRANSPORT_DECODING,

    /** iOS: "Foto lukte niet — je mag het nog een keer proberen." */
    PHOTO_PROCESSING_FAILED,

    /** iOS: "Foto wordt nagekeken… kom zo nog even terug." */
    PHOTO_PROCESSING_TIMEOUT,

    /** iOS: "Face ID is nu niet beschikbaar. Gebruik je pincode." */
    BIOMETRICS_UNAVAILABLE,

    /** iOS: "Geen probleem — je kunt je pincode gebruiken." */
    BIOMETRICS_CANCELLED,

    /** iOS: "Inloggen met Apple lukte niet. Probeer het opnieuw." */
    APPLE_SIGN_IN_FAILED,

    /** iOS: "Koppel eerst een kindprofiel voordat je een taak toevoegt." */
    PARENT_TASKS_NEED_CHILD,
}

/**
 * Carries a [UserMessage] alongside an optional server-supplied message.
 *
 * When the API returns a localised message in its error envelope we prefer it (the Worker
 * already speaks Dutch); otherwise the UI falls back to the [UserMessage] resource.
 */
public data class LocalisedFailure(
    val message: UserMessage,
    val serverMessage: String? = null,
)
