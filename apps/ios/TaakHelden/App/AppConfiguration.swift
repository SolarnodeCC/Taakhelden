import Foundation

/// Build-time / runtime API base URL resolution for App Store-safe builds.
///
/// Order: process environment override → Info.plist (`TAAKHELDEN_API_BASE_URL`) →
/// production Workers URL. Never falls back to localhost (that broke Review builds).
enum AppConfiguration {
    /// Public staging/production API used when Info.plist is missing the key.
    static let productionAPIBaseURLString = "https://taakhelden-api.oostelaar.workers.dev/v1"

    static func apiBaseURL(
        processEnvironment: [String: String] = ProcessInfo.processInfo.environment,
        infoDictionary: [String: Any]? = Bundle.main.infoDictionary
    ) -> URL {
        if let raw = processEnvironment["TAAKHELDEN_API_BASE_URL"]?.trimmingCharacters(in: .whitespacesAndNewlines),
           !raw.isEmpty,
           let url = URL(string: raw)
        {
            return url
        }
        if let raw = infoDictionary?["TAAKHELDEN_API_BASE_URL"] as? String {
            let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            // Unexpanded `$(TAAKHELDEN_API_BASE_URL)` must not win over the safety net.
            if !trimmed.isEmpty, !trimmed.hasPrefix("$("), let url = URL(string: trimmed) {
                return url
            }
        }
        return URL(string: productionAPIBaseURLString)!
    }
}
