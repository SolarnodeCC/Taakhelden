import XCTest
@testable import TaakHelden

final class ContractDecoderTests: XCTestCase {
    func testChildTodayViewDecodesViewerDiscriminator() throws {
        let json = """
        {
          "viewer": "child",
          "date": "2026-07-28",
          "instances": [],
          "balance": {
            "childId": "ch_1",
            "balance": 12,
            "todayCompleted": 2,
            "todayTotal": 3,
            "weekProgress": 0.5,
            "streakDays": 4,
            "lifetimeEarned": 120
          }
        }
        """.data(using: .utf8)!

        let decoded = try JSONDecoder.apiDecoder.decode(ChildTodayViewDTO.self, from: json)
        XCTAssertEqual(decoded.viewer, "child")
        XCTAssertEqual(decoded.balance.balance, 12)
    }

    func testSyncResponseDecodesAppliedAndRejected() throws {
        let json = """
        {
          "results": [
            { "key": "k1", "status": "applied", "newBalance": 20 },
            { "key": "k2", "status": "rejected", "code": "INSUFFICIENT_POINTS", "message": "Niet genoeg punten" }
          ],
          "changes": { "ledger": [], "instances": [] },
          "serverTime": "2026-07-28T10:00:00Z"
        }
        """.data(using: .utf8)!

        let decoded = try JSONDecoder.apiDecoder.decode(SyncResponseDTO.self, from: json)
        XCTAssertEqual(decoded.results.count, 2)
        XCTAssertEqual(decoded.results[1].code, "INSUFFICIENT_POINTS")
    }
}
