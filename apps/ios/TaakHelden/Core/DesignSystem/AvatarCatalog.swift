import Foundation

enum AvatarCatalog {
    private static let emojiByID: [String: String] = [
        "fox": "🦊",
        "panda": "🐼",
        "lion": "🦁",
        "octopus": "🐙",
        "unicorn": "🦄",
        "tiger": "🐯",
    ]

    static let selectableIDs = ["fox", "panda", "lion", "octopus", "unicorn", "tiger"]

    static func id(forEmoji emoji: String) -> String {
        emojiByID.first(where: { $0.value == emoji })?.key ?? selectableIDs[0]
    }

    static func emoji(for avatarID: String?) -> String {
        guard let avatarID, let emoji = emojiByID[avatarID] else {
            return "🦊"
        }
        return emoji
    }

    static func ageBand(from ageMode: String?) -> ChildAgeBand {
        switch ageMode {
        case "young": return .young
        case "teen": return .teen
        default: return .mid
        }
    }

    static func ageBand(fromBirthYear birthYear: Int) -> ChildAgeBand {
        let age = Calendar.current.component(.year, from: Date()) - birthYear
        if age <= 7 { return .young }
        if age >= 13 { return .teen }
        return .mid
    }
}
