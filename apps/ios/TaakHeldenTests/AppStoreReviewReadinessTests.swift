import XCTest
@testable import TaakHelden

final class AppStoreReviewReadinessTests: XCTestCase {
    func testApiBaseURLUsesProcessEnvironmentOverride() {
        let url = AppConfiguration.apiBaseURL(
            processEnvironment: ["TAAKHELDEN_API_BASE_URL": "https://staging.example/v1"],
            infoDictionary: ["TAAKHELDEN_API_BASE_URL": "http://localhost:8787/v1"]
        )
        XCTAssertEqual(url.absoluteString, "https://staging.example/v1")
    }

    func testApiBaseURLUsesInfoPlistWhenEnvMissing() {
        let url = AppConfiguration.apiBaseURL(
            processEnvironment: [:],
            infoDictionary: ["TAAKHELDEN_API_BASE_URL": "https://plist.example/v1"]
        )
        XCTAssertEqual(url.absoluteString, "https://plist.example/v1")
    }

    func testApiBaseURLNeverFallsBackToLocalhost() {
        let url = AppConfiguration.apiBaseURL(processEnvironment: [:], infoDictionary: [:])
        XCTAssertEqual(url.absoluteString, AppConfiguration.productionAPIBaseURLString)
        XCTAssertFalse(url.absoluteString.contains("localhost"))
    }

    func testApiBaseURLIgnoresUnexpandedBuildSettingPlaceholder() {
        let url = AppConfiguration.apiBaseURL(
            processEnvironment: [:],
            infoDictionary: ["TAAKHELDEN_API_BASE_URL": "$(TAAKHELDEN_API_BASE_URL)"]
        )
        XCTAssertEqual(url.absoluteString, AppConfiguration.productionAPIBaseURLString)
    }

    func testProductionApiUsesHttps() {
        let url = URL(string: AppConfiguration.productionAPIBaseURLString)!
        XCTAssertEqual(url.scheme, "https")
        XCTAssertTrue(url.path.hasSuffix("/v1") || url.absoluteString.hasSuffix("/v1"))
    }
}
