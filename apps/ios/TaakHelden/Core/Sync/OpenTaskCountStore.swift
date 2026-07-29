import Foundation

/// App Group bridge for the optional home-screen widget and main app.
/// Included from both targets when the widget is wired in XcodeGen.
enum OpenTaskCountStore {
    static let shared = OpenTaskCountStoreBox()
}

final class OpenTaskCountStoreBox: @unchecked Sendable {
    private let defaults: UserDefaults
    private let key = "taakhelden.openTaskCount"

    init(suiteName: String = "group.nl.taakhelden.family") {
        defaults = UserDefaults(suiteName: suiteName) ?? .standard
    }

    func update(count: Int) {
        defaults.set(count, forKey: key)
    }

    var count: Int {
        defaults.integer(forKey: key)
    }
}
