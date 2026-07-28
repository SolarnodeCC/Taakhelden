import Foundation

protocol APIClient {
    func fetchWelcomeContext() async throws -> WelcomeContext
    func resolveFamilyCode(_ code: String) async throws -> FamilyCodeLookup
    func pairChild(request: ChildPairingRequest) async throws -> ChildSession
}

struct WelcomeContext {
    let familyPitch: String
}

struct FamilyCodeLookup: Equatable {
    let familyName: String
    let children: [ChildProfileSummary]
}

struct ChildProfileSummary: Identifiable, Equatable {
    let id: String
    let displayName: String
    let avatar: String
    let ageBand: ChildAgeBand
}

struct ChildPairingRequest: Equatable {
    let familyCode: String
    let childID: String
    let pin: String
    let ageBand: ChildAgeBand
}

struct ChildSession: Equatable {
    let childID: String
    let displayName: String
    let avatar: String
    let ageBand: ChildAgeBand
    let accessToken: String
    let refreshToken: String
}

enum ContractSource {
    static let bundledSnapshotPath = "apps/ios/openapi/openapi.json"
    static let upstreamSnapshotPath = "docs/openapi/taakhelden-core-v1.json"
    static let contractVersionHeader = "2"
}

struct PreviewAPIClient: APIClient {
    func fetchWelcomeContext() async throws -> WelcomeContext {
        WelcomeContext(familyPitch: "Samen taken doen voelt lichter als je kleine helden ermee kunnen groeien.")
    }

    func resolveFamilyCode(_ code: String) async throws -> FamilyCodeLookup {
        let normalized = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard normalized.count == 6 else {
            throw APIClientError.invalidFamilyCode
        }

        return FamilyCodeLookup(
            familyName: "Familie Vermeer",
            children: [
                ChildProfileSummary(id: "child-sam", displayName: "Sam", avatar: "🦊", ageBand: .mid),
                ChildProfileSummary(id: "child-noor", displayName: "Noor", avatar: "🐼", ageBand: .teen),
            ]
        )
    }

    func pairChild(request: ChildPairingRequest) async throws -> ChildSession {
        guard request.pin.count == 4 else {
            throw APIClientError.invalidPin
        }

        return ChildSession(
            childID: request.childID,
            displayName: request.childID == "child-noor" ? "Noor" : "Sam",
            avatar: request.childID == "child-noor" ? "🐼" : "🦊",
            ageBand: request.childID == "child-noor" ? .teen : .mid,
            accessToken: "preview-child-access",
            refreshToken: "preview-child-refresh"
        )
    }
}

enum APIClientError: LocalizedError {
    case invalidFamilyCode
    case invalidPin
    case sessionMissing

    var errorDescription: String? {
        switch self {
        case .invalidFamilyCode:
            return "Die gezinscode lijkt nog niet compleet."
        case .invalidPin:
            return "Die pincode mist nog een paar cijfers."
        case .sessionMissing:
            return "Je sessie is verlopen. Koppel dit toestel opnieuw."
        }
    }
}
