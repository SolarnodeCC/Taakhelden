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

struct GeneratedContractAPIClient: APIClient {
    let baseURL: URL
    let contractVersion: String

    init(
        baseURL: URL = URL(string: "http://localhost:8787/v1")!,
        contractVersion: String = ContractSource.contractVersionHeader
    ) {
        self.baseURL = baseURL
        self.contractVersion = contractVersion
    }

    func fetchWelcomeContext() async throws -> WelcomeContext {
        throw APIClientError.generatedClientNotWired
    }

    func resolveFamilyCode(_ code: String) async throws -> FamilyCodeLookup {
        throw APIClientError.generatedClientNotWired
    }

    func pairChild(request: ChildPairingRequest) async throws -> ChildSession {
        throw APIClientError.generatedClientNotWired
    }
}

enum APIClientError: LocalizedError {
    case invalidFamilyCode
    case invalidPin
    case generatedClientNotWired

    var errorDescription: String? {
        switch self {
        case .invalidFamilyCode:
            return "Die gezinscode lijkt nog niet compleet."
        case .invalidPin:
            return "Die pincode mist nog een paar cijfers."
        case .generatedClientNotWired:
            return "De gegenereerde API-client moet nog op macOS worden opgebouwd vanuit het gedeelde contract."
        }
    }
}
