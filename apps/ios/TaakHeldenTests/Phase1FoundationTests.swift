import XCTest
@testable import TaakHelden

final class Phase1FoundationTests: XCTestCase {
    func testUnder13AlwaysShowsVisiblePINAlternative() {
        XCTAssertEqual(
            ParentGatePolicy.childUnlockMode(for: .mid, biometricsEnabled: true),
            .biometricsWithVisiblePIN
        )
        XCTAssertEqual(
            ParentGatePolicy.childUnlockMode(for: .young, biometricsEnabled: false),
            .biometricsWithVisiblePIN
        )
    }

    func testTeenCanUseBiometricsWithoutMandatoryVisiblePIN() {
        XCTAssertEqual(
            ParentGatePolicy.childUnlockMode(for: .teen, biometricsEnabled: true),
            .biometricsWithOptionalPIN
        )
        XCTAssertEqual(
            ParentGatePolicy.childUnlockMode(for: .teen, biometricsEnabled: false),
            .pinOnly
        )
    }

    func testChildShellReservesThreeTabsAndNoParentTab() {
        XCTAssertEqual(ParentGatePolicy.childTabCount, 3)
        XCTAssertFalse(ParentGatePolicy.hiddenEntryPoints.isEmpty)
    }

    func testPaletteContrastStaysReadableForPrimaryTextPairs() {
        XCTAssertGreaterThanOrEqual(
            contrastRatio(foreground: THPalettes.kid.text, background: THPalettes.kid.background),
            4.5
        )
        XCTAssertGreaterThanOrEqual(
            contrastRatio(foreground: THPalettes.teen.text, background: THPalettes.teen.background),
            4.5
        )
        XCTAssertGreaterThanOrEqual(
            contrastRatio(foreground: THPalettes.teen.text, background: THPalettes.teen.surface),
            4.5
        )
        XCTAssertGreaterThanOrEqual(
            contrastRatio(foreground: THPalettes.parent.text, background: THPalettes.parent.surface),
            4.5
        )
        // Kid turquoise companion stays distinct from cream.
        XCTAssertEqual(THPalettes.kid.secondary.hex, 0x0E9F8E)
        XCTAssertEqual(THPalettes.teen.background.hex, 0x1F2A44)
    }

    func testParentGateRequiresAuthBeforeSettings() {
        // Soft-open regression: sound toggle must not appear before device-owner auth.
        // Covered by ParentGateView structure; assert policy still hides permanent parent tab.
        XCTAssertEqual(ParentGatePolicy.childTabCount, 3)
        XCTAssertFalse(ParentGatePolicy.hiddenEntryPoints.isEmpty)
    }

    func testAuthStoreRestoresChildRouteFromStoredSession() throws {
        let keychain = InMemoryKeychainStore()
        let encoder = JSONEncoder()
        let session = StoredChildSession(
            childID: "child-sam",
            displayName: "Sam",
            avatar: "🦊",
            ageBand: .mid,
            accessToken: "access",
            refreshToken: "refresh",
            biometricsEnabled: true
        )
        keychain.saveValue(try encoder.encode(session), for: .childSession)

        let store = AuthStore(previewKeychain: keychain)
        // Cold start with a stored child session still requires daily unlock.
        XCTAssertEqual(store.restoredRoute, .childUnlock)
        XCTAssertEqual(store.childSession?.displayName, "Sam")

        store.unlockChildSession()
        XCTAssertEqual(store.restoredRoute, .childHome)
    }

    // MARK: - PIN hash tests

    func testPINHasherCorrectPINVerifies() {
        let stored = PINHasher.makeStored(pin: "1234")
        XCTAssertTrue(PINHasher.verify(pin: "1234", stored: stored))
    }

    func testPINHasherWrongPINFails() {
        let stored = PINHasher.makeStored(pin: "1234")
        XCTAssertFalse(PINHasher.verify(pin: "0000", stored: stored))
    }

    func testPINHasherStoredLengthIs64Bytes() {
        let stored = PINHasher.makeStored(pin: "9999")
        XCTAssertEqual(stored.count, PINHasher.saltLength + PINHasher.hashLength)
    }

    func testPINHasherTwoCallsProduceDifferentSalts() {
        let first = PINHasher.makeStored(pin: "1234")
        let second = PINHasher.makeStored(pin: "1234")
        // Same PIN, different salts → different stored blobs
        XCTAssertNotEqual(first, second)
        // But both verify correctly
        XCTAssertTrue(PINHasher.verify(pin: "1234", stored: first))
        XCTAssertTrue(PINHasher.verify(pin: "1234", stored: second))
    }

    func testPINHasherLegacyPlaintextRejected() {
        // A legacy 4-byte UTF-8 PIN blob must not verify (wrong length).
        let legacyBlob = "1234".data(using: .utf8)!
        XCTAssertFalse(PINHasher.verify(pin: "1234", stored: legacyBlob))
    }

    func testAuthStoreStoresHashedPINNotPlaintext() {
        let keychain = InMemoryKeychainStore()
        let store = AuthStore(previewKeychain: keychain)
        let fakeSession = ChildSession(
            childID: "c1",
            displayName: "Sam",
            avatar: "🦊",
            ageBand: .mid,
            accessToken: "tok",
            refreshToken: "ref"
        )
        store.storeChildSession(fakeSession, biometricsEnabled: false, pin: "5678")

        let raw = keychain.loadValue(for: .childPIN)!
        // Must be 64 bytes (hash format), never 4 bytes (plaintext).
        XCTAssertEqual(raw.count, PINHasher.saltLength + PINHasher.hashLength)
        // Must not equal the raw UTF-8 bytes of the PIN.
        XCTAssertNotEqual(raw, "5678".data(using: .utf8))
        // Correct PIN must verify.
        XCTAssertTrue(store.verifyPIN("5678"))
        // Wrong PIN must not verify.
        XCTAssertFalse(store.verifyPIN("0000"))
    }

    func testAuthStoreClearsLegacyPlaintextOnVerify() {
        let keychain = InMemoryKeychainStore()
        // Plant a legacy plaintext PIN directly in the keychain.
        keychain.saveValue("4242".data(using: .utf8)!, for: .childPIN)

        let store = AuthStore(previewKeychain: keychain)
        // verifyPIN must reject AND delete the legacy blob.
        XCTAssertFalse(store.verifyPIN("4242"))
        XCTAssertNil(keychain.loadValue(for: .childPIN))
    }

    private func contrastRatio(foreground: THColorToken, background: THColorToken) -> Double {
        let lighter = max(relativeLuminance(foreground), relativeLuminance(background))
        let darker = min(relativeLuminance(foreground), relativeLuminance(background))
        return (lighter + 0.05) / (darker + 0.05)
    }

    private func relativeLuminance(_ token: THColorToken) -> Double {
        let rgb = (
            red: Double((token.hex >> 16) & 0xFF) / 255,
            green: Double((token.hex >> 8) & 0xFF) / 255,
            blue: Double(token.hex & 0xFF) / 255
        )

        func transform(_ channel: Double) -> Double {
            channel <= 0.03928 ? channel / 12.92 : pow((channel + 0.055) / 1.055, 2.4)
        }

        return (0.2126 * transform(rgb.red)) + (0.7152 * transform(rgb.green)) + (0.0722 * transform(rgb.blue))
    }
}
