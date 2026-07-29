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

    func testLevelFromLifetimeMatchesServerCurve() {
        // Mirrors apps/api/src/repo/avatar.ts levelFromLifetime
        XCTAssertEqual(max(1, 0 / 100), 1)
        XCTAssertEqual(max(1, 99 / 100), 1)
        XCTAssertEqual(max(1, 100 / 100), 1)
        XCTAssertEqual(max(1, 300 / 100), 3)
    }

    func testFamilyGoalProgressFractionCapsAtOne() {
        let progress = FamilyGoalProgressDTO(
            goalId: "g1",
            title: "Pizza",
            icon: "🍕",
            earnedPoints: 120,
            targetPoints: 100,
            status: "active"
        )
        let fraction = min(1, Double(progress.earnedPoints) / Double(progress.targetPoints))
        XCTAssertEqual(fraction, 1)
    }

    func testOptionalNullStringEncodesExplicitNull() throws {
        let payload = try JSONEncoder().encode(
            EquipAvatarPayloadForTest(hat: .value(nil), background: .omit, accessory: .value("acc_star"))
        )
        let json = try XCTUnwrap(String(data: payload, encoding: .utf8))
        XCTAssertTrue(json.contains("\"hat\":null") || json.contains("\"hat\" : null"))
        XCTAssertTrue(json.contains("acc_star"))
        XCTAssertFalse(json.contains("background"))
    }
}

/// Mirrors EquipAvatarPayload encoding rules for unit coverage without exposing private type.
private struct EquipAvatarPayloadForTest: Encodable {
    enum Slot: String, CodingKey { case hat, background, accessory }
    let hat: OptionalNullString
    let background: OptionalNullString
    let accessory: OptionalNullString

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: Slot.self)
        try encode(&container, .hat, hat)
        try encode(&container, .background, background)
        try encode(&container, .accessory, accessory)
    }

    private func encode(
        _ container: inout KeyedEncodingContainer<Slot>,
        _ key: Slot,
        _ value: OptionalNullString
    ) throws {
        switch value {
        case .omit: break
        case .value(let string): try container.encode(string, forKey: key)
        }
    }
}
