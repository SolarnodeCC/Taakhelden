import XCTest
@testable import TaakHelden

final class Phase3WorkstreamTests: XCTestCase {
    func testPicturePINMatchRequiresExactSequence() {
        XCTAssertTrue(
            YoungModeSupport.matchesPicturePIN(
                selection: ["🦊", "🐼", "🦁"],
                stored: ["🦊", "🐼", "🦁"]
            )
        )
        XCTAssertFalse(
            YoungModeSupport.matchesPicturePIN(
                selection: ["🦊", "🦁", "🐼"],
                stored: ["🦊", "🐼", "🦁"]
            )
        )
        XCTAssertFalse(
            YoungModeSupport.matchesPicturePIN(selection: ["🦊"], stored: ["🦊", "🐼", "🦁"])
        )
    }

    func testYoungModeTapTargetMeetsAccessibilityFloor() {
        XCTAssertGreaterThanOrEqual(YoungModeSupport.minTapTarget, 64)
    }

    func testHeroProgressLevelMatchesServerCurve() {
        XCTAssertEqual(HeroProgress.level(fromLifetime: 0), 1)
        XCTAssertEqual(HeroProgress.level(fromLifetime: 99), 1)
        XCTAssertEqual(HeroProgress.level(fromLifetime: 100), 1)
        XCTAssertEqual(HeroProgress.level(fromLifetime: 300), 3)

        let hero = ChildHeroViewModel(displayName: "Sam", avatar: "🦊", lifetimeEarned: 300, streakDays: 2)
        XCTAssertEqual(hero.level, 3)
    }

    func testFamilyGoalProgressFractionCapsAtOne() {
        XCTAssertEqual(HeroProgress.goalFraction(earned: 120, target: 100), 1)
        XCTAssertEqual(HeroProgress.goalFraction(earned: 50, target: 100), 0.5)
        XCTAssertEqual(HeroProgress.goalFraction(earned: 10, target: 0), 0)
    }

    func testOptionalNullStringEncodesExplicitNull() throws {
        let payload = try JSONEncoder().encode(
            EquipAvatarPayload(hat: .value(nil), background: .omit, accessory: .value("acc_star"))
        )
        let json = try XCTUnwrap(String(data: payload, encoding: .utf8))
        XCTAssertTrue(json.contains("\"hat\":null") || json.contains("\"hat\" : null"))
        XCTAssertTrue(json.contains("acc_star"))
        XCTAssertFalse(json.contains("background"))
    }

    func testOnAccentContrastsAgainstAccentFills() {
        XCTAssertGreaterThanOrEqual(
            contrastRatio(foreground: THPalettes.kid.onAccent, background: THPalettes.kid.accent),
            3.0
        )
        XCTAssertGreaterThanOrEqual(
            contrastRatio(foreground: THPalettes.teen.onAccent, background: THPalettes.teen.accent),
            3.0
        )
        XCTAssertGreaterThanOrEqual(
            contrastRatio(foreground: THPalettes.parent.onAccent, background: THPalettes.parent.accent),
            3.0
        )
    }

    func testAgeBandMappingFromServerAgeMode() {
        XCTAssertEqual(AvatarCatalog.ageBand(from: "young"), .young)
        XCTAssertEqual(AvatarCatalog.ageBand(from: "teen"), .teen)
        XCTAssertEqual(AvatarCatalog.ageBand(from: "mid"), .mid)
        XCTAssertEqual(AvatarCatalog.ageBand(from: nil), .mid)
    }
}

private func contrastRatio(foreground: THColorToken, background: THColorToken) -> Double {
    func luminance(_ token: THColorToken) -> Double {
        func channel(_ value: UInt64, shift: Int) -> Double {
            let c = Double((value >> shift) & 0xFF) / 255.0
            return c <= 0.03928 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
        }
        let r = channel(token.hex, shift: 16)
        let g = channel(token.hex, shift: 8)
        let b = channel(token.hex, shift: 0)
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    let l1 = luminance(foreground)
    let l2 = luminance(background)
    let lighter = max(l1, l2)
    let darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)
}
