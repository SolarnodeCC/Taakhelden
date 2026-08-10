package nl.taakhelden.family.platform

import android.content.Context
import android.content.SharedPreferences
import android.util.Base64
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import nl.taakhelden.core.auth.SecureStore
import nl.taakhelden.core.auth.SecureStoreKey

/**
 * Keystore-backed session storage — the Android counterpart of the iOS Keychain store.
 *
 * The master key never leaves the hardware-backed keystore, and the file is not backed up
 * (see `data_extraction_rules.xml`), so a device-to-device transfer cannot carry a child's
 * session or PIN hash with it.
 */
class EncryptedSecureStore(context: Context) : SecureStore {

    private val preferences: SharedPreferences = run {
        val applicationContext = context.applicationContext
        val masterKey = MasterKey.Builder(applicationContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        EncryptedSharedPreferences.create(
            applicationContext,
            FILE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    override fun loadValue(key: SecureStoreKey): ByteArray? {
        val encoded = preferences.getString(key.storageName, null) ?: return null
        // Values are raw bytes (the PIN blob is binary), so they are Base64-wrapped to
        // survive the String-typed SharedPreferences API intact.
        return runCatching { Base64.decode(encoded, Base64.NO_WRAP) }.getOrNull()
    }

    override fun saveValue(value: ByteArray, key: SecureStoreKey) {
        preferences.edit()
            .putString(key.storageName, Base64.encodeToString(value, Base64.NO_WRAP))
            .apply()
    }

    override fun deleteValue(key: SecureStoreKey) {
        preferences.edit().remove(key.storageName).apply()
    }

    private companion object {
        const val FILE_NAME = "wispel_sessions"
    }
}
