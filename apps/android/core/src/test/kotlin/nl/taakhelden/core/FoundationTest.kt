package nl.taakhelden.core

import nl.taakhelden.core.auth.AuthStore
import nl.taakhelden.core.auth.ChildAgeBand
import nl.taakhelden.core.auth.ChildSession
import nl.taakhelden.core.auth.InMemorySecureStore
import nl.taakhelden.core.auth.PinHasher
import nl.taakhelden.core.auth.SecureStoreKey
import nl.taakhelden.core.auth.StoredChildSession
import nl.taakhelden.core.designsystem.ContrastMath
import nl.taakhelden.core.designsystem.WPalettes
import nl.taakhelden.core.api.apiJson
import nl.taakhelden.core.auth.AppRestoreRoute
import nl.taakhelden.core.gate.ChildUnlockMode
import nl.taakhelden.core.gate.ParentGatePolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FoundationTest {

    @Test
    fun `under 13 always shows a visible PIN alternative`() {
        assertEquals(
            ChildUnlockMode.BIOMETRICS_WITH_VISIBLE_PIN,
            ParentGatePolicy.childUnlockMode(ChildAgeBand.MID, biometricsEnabled = true),
        )
        assertEquals(
            ChildUnlockMode.BIOMETRICS_WITH_VISIBLE_PIN,
            ParentGatePolicy.childUnlockMode(ChildAgeBand.YOUNG, biometricsEnabled = false),
        )
    }

    @Test
    fun `teen can use biometrics without a mandatory visible PIN`() {
        assertEquals(
            ChildUnlockMode.BIOMETRICS_WITH_OPTIONAL_PIN,
            ParentGatePolicy.childUnlockMode(ChildAgeBand.TEEN, biometricsEnabled = true),
        )
        assertEquals(
            ChildUnlockMode.PIN_ONLY,
            ParentGatePolicy.childUnlockMode(ChildAgeBand.TEEN, biometricsEnabled = false),
        )
    }

    @Test
    fun `child shell reserves three tabs and no parent tab`() {
        assertEquals(3, ParentGatePolicy.CHILD_TAB_COUNT)
        assertTrue(ParentGatePolicy.hiddenEntryPoints.isNotEmpty())
    }

    @Test
    fun `palette contrast stays readable for primary text pairs`() {
        assertTrue(
            ContrastMath.contrastRatio(WPalettes.kid.text, WPalettes.kid.background) >= 4.5,
        )
        assertTrue(
            ContrastMath.contrastRatio(WPalettes.teen.text, WPalettes.teen.background) >= 4.5,
        )
        assertTrue(
            ContrastMath.contrastRatio(WPalettes.teen.text, WPalettes.teen.surface) >= 4.5,
        )
        assertTrue(
            ContrastMath.contrastRatio(WPalettes.parent.text, WPalettes.parent.surface) >= 4.5,
        )
        // Kid turquoise companion stays distinct from cream.
        assertEquals(0x0E9F8E, WPalettes.kid.secondary.hex)
        assertEquals(0x1F2A44, WPalettes.teen.background.hex)
    }

    @Test
    fun `auth store restores the child route from a stored session`() {
        val secureStore = InMemorySecureStore()
        val session = StoredChildSession(
            childId = "child-sam",
            displayName = "Sam",
            avatar = "🦊",
            ageBand = ChildAgeBand.MID,
            accessToken = "access",
            refreshToken = "refresh",
            biometricsEnabled = true,
        )
        secureStore.saveValue(
            apiJson.encodeToString(StoredChildSession.serializer(), session).toByteArray(),
            SecureStoreKey.CHILD_SESSION,
        )

        val store = AuthStore(secureStore)
        // A cold start with a stored child session still requires the daily unlock.
        assertEquals(AppRestoreRoute.CHILD_UNLOCK, store.restoredRoute)
        assertEquals("Sam", store.childSession?.displayName)

        store.unlockChildSession()
        assertEquals(AppRestoreRoute.CHILD_HOME, store.restoredRoute)
    }

    // MARK: - PIN hashing

    @Test
    fun `correct PIN verifies`() {
        val stored = PinHasher.makeStored("1234")
        assertTrue(PinHasher.verify("1234", stored))
    }

    @Test
    fun `wrong PIN fails`() {
        val stored = PinHasher.makeStored("1234")
        assertFalse(PinHasher.verify("0000", stored))
    }

    @Test
    fun `stored PIN blob is 64 bytes`() {
        val stored = PinHasher.makeStored("9999")
        assertEquals(PinHasher.SALT_LENGTH + PinHasher.HASH_LENGTH, stored.size)
    }

    @Test
    fun `two calls produce different salts but both verify`() {
        val first = PinHasher.makeStored("1234")
        val second = PinHasher.makeStored("1234")

        assertFalse(first.contentEquals(second))
        assertTrue(PinHasher.verify("1234", first))
        assertTrue(PinHasher.verify("1234", second))
    }

    @Test
    fun `plaintext PIN blob from before hashing is rejected`() {
        val plaintextBlob = "1234".toByteArray(Charsets.UTF_8)
        assertFalse(PinHasher.verify("1234", plaintextBlob))
    }

    @Test
    fun `auth store persists a hashed PIN, never plaintext`() {
        val secureStore = InMemorySecureStore()
        val store = AuthStore(secureStore)
        store.storeChildSession(
            ChildSession(
                childId = "c1",
                displayName = "Sam",
                avatar = "🦊",
                ageBand = ChildAgeBand.MID,
                accessToken = "tok",
                refreshToken = "ref",
            ),
            biometricsEnabled = false,
            pin = "5678",
        )

        val raw = requireNotNull(secureStore.loadValue(SecureStoreKey.CHILD_PIN))
        assertEquals(PinHasher.SALT_LENGTH + PinHasher.HASH_LENGTH, raw.size)
        assertNotEquals("5678", raw.toString(Charsets.UTF_8))
        assertTrue(store.verifyPin("5678"))
        assertFalse(store.verifyPin("0000"))
    }

    @Test
    fun `auth store clears a pre-hash plaintext PIN on verify`() {
        val secureStore = InMemorySecureStore()
        // Plant a pre-hash plaintext PIN directly in secure storage.
        secureStore.saveValue("4242".toByteArray(Charsets.UTF_8), SecureStoreKey.CHILD_PIN)

        val store = AuthStore(secureStore)
        assertFalse(store.verifyPin("4242"))
        assertNull(secureStore.loadValue(SecureStoreKey.CHILD_PIN))
    }
}
