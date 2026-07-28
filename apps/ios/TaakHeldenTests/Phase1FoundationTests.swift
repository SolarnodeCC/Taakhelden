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
            contrastRatio(foreground: THPalettes.teen.text, background: THPalettes.teen.surface),
            4.5
        )
        XCTAssertGreaterThanOrEqual(
            contrastRatio(foreground: THPalettes.parent.text, background: THPalettes.parent.surface),
            4.5
        )
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
        XCTAssertEqual(store.restoredRoute, .childHome)
        XCTAssertEqual(store.childSession?.displayName, "Sam")
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
