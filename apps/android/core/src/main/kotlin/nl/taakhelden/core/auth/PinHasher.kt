package nl.taakhelden.core.auth

import java.security.MessageDigest
import java.security.SecureRandom

/**
 * Hashes and verifies child PINs using a device-unique random salt + SHA-256.
 *
 * Stored layout (64 bytes) — byte-for-byte identical to the iOS `PINHasher`:
 *   [0 ..< 32]  random salt (generated once per store call)
 *   [32 ..< 64] SHA-256(salt ‖ PIN-UTF8)
 *
 * No raw PIN is ever written to storage. A stored blob whose length is not exactly
 * 64 bytes (e.g. a legacy UTF-8 plaintext PIN) is treated as invalid, causing
 * [verify] to return false.
 */
public object PinHasher {
    public const val SALT_LENGTH: Int = 32

    /** SHA-256 output = 32 bytes. */
    public const val HASH_LENGTH: Int = 32

    private val random = SecureRandom()

    /**
     * Creates a fresh 64-byte salt+hash blob for [pin].
     * Call this every time a new PIN is stored (e.g. after pairing).
     */
    public fun makeStored(pin: String): ByteArray {
        val salt = ByteArray(SALT_LENGTH).also(random::nextBytes)
        return salt + digest(pin, salt)
    }

    /**
     * Returns `true` iff [pin] matches the blob produced by [makeStored].
     * Returns `false` for any blob that is not exactly 64 bytes.
     */
    public fun verify(pin: String, stored: ByteArray): Boolean {
        if (stored.size != SALT_LENGTH + HASH_LENGTH) return false
        val salt = stored.copyOfRange(0, SALT_LENGTH)
        val storedHash = stored.copyOfRange(SALT_LENGTH, stored.size)
        // Constant-time compare so a wrong PIN cannot be narrowed down by timing.
        return MessageDigest.isEqual(digest(pin, salt), storedHash)
    }

    private fun digest(pin: String, salt: ByteArray): ByteArray =
        MessageDigest.getInstance("SHA-256").run {
            update(salt)
            update(pin.toByteArray(Charsets.UTF_8))
            digest()
        }
}
