package nl.taakhelden.core.auth

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable
import nl.taakhelden.core.api.apiJson

public enum class AppRestoreRoute {
    WELCOME,
    PARENT_ONBOARDING,
    CHILD_UNLOCK,
    CHILD_HOME,
}

@Serializable
public enum class ChildAgeBand {
    YOUNG,
    MID,
    TEEN,
    ;

    /**
     * Under-13 profiles always keep a visible PIN alternative next to biometrics
     * (ADR-0002) — biometrics may be unavailable or shared, and a child must never be
     * locked out of their own space.
     */
    public val requiresVisiblePinAlternative: Boolean
        get() = when (this) {
            YOUNG, MID -> true
            TEEN -> false
        }
}

@Serializable
public data class ParentSession(
    val accessToken: String,
    val refreshToken: String,
    val familyId: String,
    val userId: String,
)

@Serializable
public data class StoredChildSession(
    val childId: String,
    val displayName: String,
    val avatar: String,
    val ageBand: ChildAgeBand,
    val accessToken: String,
    val refreshToken: String,
    val biometricsEnabled: Boolean = false,
)

/** Transport-level child session as returned by pairing/refresh. */
public data class ChildSession(
    val childId: String,
    val displayName: String,
    val avatar: String,
    val ageBand: ChildAgeBand,
    val accessToken: String,
    val refreshToken: String,
)

public enum class SecureStoreKey(public val storageName: String) {
    PARENT_SESSION("parentSession"),
    CHILD_SESSION("childSession"),
    CHILD_PIN("childPIN"),
}

/**
 * Platform-backed secret storage. The Android implementation wraps
 * EncryptedSharedPreferences (Keystore-backed); tests use [InMemorySecureStore].
 *
 * This is the Android counterpart of the iOS `KeychainStore` protocol.
 */
public interface SecureStore {
    public fun loadValue(key: SecureStoreKey): ByteArray?
    public fun saveValue(value: ByteArray, key: SecureStoreKey)
    public fun deleteValue(key: SecureStoreKey)
}

public class InMemorySecureStore : SecureStore {
    private val storage = mutableMapOf<SecureStoreKey, ByteArray>()

    override fun loadValue(key: SecureStoreKey): ByteArray? = storage[key]

    override fun saveValue(value: ByteArray, key: SecureStoreKey) {
        storage[key] = value
    }

    override fun deleteValue(key: SecureStoreKey) {
        storage.remove(key)
    }
}

/**
 * Holds the parent and child sessions for this device.
 *
 * Mirrors the iOS `AuthStore`, including the rule that a restored child session always
 * starts locked: reopening the app must land on the unlock screen, never straight in the
 * child's home.
 */
public class AuthStore(
    private val secureStore: SecureStore = InMemorySecureStore(),
) {
    private val _parentSession = MutableStateFlow<ParentSession?>(null)
    public val parentSessionFlow: StateFlow<ParentSession?> = _parentSession.asStateFlow()

    private val _childSession = MutableStateFlow<StoredChildSession?>(null)
    public val childSessionFlow: StateFlow<StoredChildSession?> = _childSession.asStateFlow()

    private val _isChildUnlocked = MutableStateFlow(false)
    public val isChildUnlockedFlow: StateFlow<Boolean> = _isChildUnlocked.asStateFlow()

    public val parentSession: ParentSession? get() = _parentSession.value
    public val childSession: StoredChildSession? get() = _childSession.value
    public val isChildUnlocked: Boolean get() = _isChildUnlocked.value

    init {
        restoreSessions()
    }

    public val restoredRoute: AppRestoreRoute
        get() = when {
            childSession != null ->
                if (isChildUnlocked) AppRestoreRoute.CHILD_HOME else AppRestoreRoute.CHILD_UNLOCK
            parentSession != null -> AppRestoreRoute.PARENT_ONBOARDING
            else -> AppRestoreRoute.WELCOME
        }

    public fun storeParentSession(session: ParentSession) {
        _parentSession.value = session
        persistParent()
    }

    public fun updateParentTokens(accessToken: String, refreshToken: String) {
        val session = _parentSession.value ?: return
        _parentSession.value = session.copy(accessToken = accessToken, refreshToken = refreshToken)
        persistParent()
    }

    public fun storeChildSession(
        session: ChildSession,
        biometricsEnabled: Boolean = false,
        pin: String,
    ) {
        val stored = StoredChildSession(
            childId = session.childId,
            displayName = session.displayName,
            avatar = session.avatar,
            ageBand = session.ageBand,
            accessToken = session.accessToken,
            refreshToken = session.refreshToken,
            biometricsEnabled = biometricsEnabled,
        )
        _childSession.value = stored
        _isChildUnlocked.value = true
        persistChild(stored)
        // Never store the raw PIN — persist only the salted SHA-256 hash.
        secureStore.saveValue(PinHasher.makeStored(pin), SecureStoreKey.CHILD_PIN)
    }

    public fun updateChildTokens(accessToken: String, refreshToken: String) {
        val session = _childSession.value ?: return
        val updated = session.copy(accessToken = accessToken, refreshToken = refreshToken)
        _childSession.value = updated
        persistChild(updated)
    }

    public fun verifyPin(pin: String): Boolean {
        val stored = secureStore.loadValue(SecureStoreKey.CHILD_PIN) ?: return false
        // Legacy check: a blob that is not the 64-byte salt+hash format is an old
        // plaintext PIN. Delete it so the next pairing upgrades to hashed storage, and
        // reject the attempt.
        if (stored.size != PinHasher.SALT_LENGTH + PinHasher.HASH_LENGTH) {
            secureStore.deleteValue(SecureStoreKey.CHILD_PIN)
            return false
        }
        return PinHasher.verify(pin, stored)
    }

    public fun lockChildSession() {
        _isChildUnlocked.value = false
    }

    public fun unlockChildSession() {
        _isChildUnlocked.value = true
    }

    public fun clearChildSession() {
        _childSession.value = null
        _isChildUnlocked.value = false
        secureStore.deleteValue(SecureStoreKey.CHILD_SESSION)
        secureStore.deleteValue(SecureStoreKey.CHILD_PIN)
    }

    public fun clearParentSession() {
        _parentSession.value = null
        secureStore.deleteValue(SecureStoreKey.PARENT_SESSION)
    }

    public fun clearAllSessions() {
        clearChildSession()
        clearParentSession()
    }

    private fun persistParent() {
        val session = _parentSession.value ?: return
        val encoded = apiJson.encodeToString(ParentSession.serializer(), session)
        secureStore.saveValue(encoded.toByteArray(Charsets.UTF_8), SecureStoreKey.PARENT_SESSION)
    }

    private fun persistChild(session: StoredChildSession) {
        val encoded = apiJson.encodeToString(StoredChildSession.serializer(), session)
        secureStore.saveValue(encoded.toByteArray(Charsets.UTF_8), SecureStoreKey.CHILD_SESSION)
    }

    private fun restoreSessions() {
        secureStore.loadValue(SecureStoreKey.PARENT_SESSION)?.let { bytes ->
            runCatching {
                apiJson.decodeFromString(ParentSession.serializer(), bytes.toString(Charsets.UTF_8))
            }.getOrNull()?.let { _parentSession.value = it }
        }

        secureStore.loadValue(SecureStoreKey.CHILD_SESSION)?.let { bytes ->
            runCatching {
                apiJson.decodeFromString(
                    StoredChildSession.serializer(),
                    bytes.toString(Charsets.UTF_8),
                )
            }.getOrNull()?.let {
                _childSession.value = it
                _isChildUnlocked.value = false
            }
        }
    }
}
