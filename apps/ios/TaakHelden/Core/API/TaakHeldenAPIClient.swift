import Foundation

@Observable
final class TaakHeldenAPIClient {
    private let transport: HTTPTransporting
    private let authStore: AuthStore
    private let refreshCoordinator: TokenRefreshCoordinator
    private let decoder = JSONDecoder.apiDecoder
    private let encoder = JSONEncoder.apiEncoder

    init(
        transport: HTTPTransporting,
        authStore: AuthStore,
        refreshCoordinator: TokenRefreshCoordinator = TokenRefreshCoordinator()
    ) {
        self.transport = transport
        self.authStore = authStore
        self.refreshCoordinator = refreshCoordinator
    }

    // MARK: - Public auth

    func resolveFamilyCode(_ code: String) async throws -> FamilyCodeLookup {
        let body = try encoder.encode(["familyCode": code])
        let response = try await transport.send(
            HTTPRequest(path: "/auth/family-code", method: .post, body: body),
            accessToken: nil
        )
        let dto = try decoder.decode(FamilyCodeResultDTO.self, from: response.data)
        return FamilyCodeLookup(
            familyName: dto.familyName,
            children: dto.children.map {
                ChildProfileSummary(
                    id: $0.id,
                    displayName: $0.displayName,
                    avatar: AvatarCatalog.emoji(for: $0.avatarId),
                    ageBand: .mid
                )
            }
        )
    }

    func pairChild(request: ChildPairingRequest) async throws -> ChildSession {
        let payload = [
            "familyCode": request.familyCode,
            "childId": request.childID,
            "pincode": request.pin,
        ]
        let body = try encoder.encode(payload)
        let response = try await transport.send(
            HTTPRequest(path: "/auth/child-session", method: .post, body: body),
            accessToken: nil
        )
        let dto = try decoder.decode(ChildSessionResultDTO.self, from: response.data)
        return mapChildSession(dto, ageBand: request.ageBand)
    }

    func refreshChildSession() async throws -> ChildSession {
        guard let refreshToken = authStore.childSession?.refreshToken else {
            throw APIClientError.sessionMissing
        }
        let dto = try await refreshCoordinator.refreshChild(refreshToken: refreshToken, transport: transport)
        let session = mapChildSession(dto, ageBand: authStore.childSession?.ageBand ?? .mid)
        authStore.updateChildTokens(accessToken: session.accessToken, refreshToken: session.refreshToken)
        return session
    }

    func signInWithApple(identityToken: String, familyName: String?, displayName: String?) async throws -> ParentSession {
        var payload: [String: String] = ["identityToken": identityToken]
        if let familyName { payload["familyName"] = familyName }
        if let displayName { payload["displayName"] = displayName }
        let body = try encoder.encode(payload)
        let response = try await transport.send(
            HTTPRequest(path: "/auth/apple", method: .post, body: body),
            accessToken: nil
        )
        let dto = try decoder.decode(ParentSessionResultDTO.self, from: response.data)
        return ParentSession(
            accessToken: dto.accessToken,
            refreshToken: dto.refreshToken,
            familyID: dto.familyId,
            userID: dto.userId
        )
    }

    func createChild(displayName: String, birthYear: Int, avatarID: String, pin: String) async throws -> MemberViewDTO {
        let payload: [String: AnyEncodable] = [
            "displayName": AnyEncodable(displayName),
            "birthYear": AnyEncodable(birthYear),
            "avatarId": AnyEncodable(avatarID),
            "pincode": AnyEncodable(pin),
        ]
        let body = try encoder.encode(payload)
        let response = try await sendAuthorized(
            HTTPRequest(path: "/members/children", method: .post, body: body, requiresAuth: true)
        )
        return try decoder.decode(MemberViewDTO.self, from: response.data)
    }

    func fetchParentFamily() async throws -> ParentFamilyViewDTO {
        let response = try await sendAuthorized(
            HTTPRequest(path: "/families/me", method: .get, requiresAuth: true, requiresContractV2: true)
        )
        return try decoder.decode(ParentFamilyViewDTO.self, from: response.data)
    }

    // MARK: - Child reads

    func fetchChildToday() async throws -> ChildTodayViewDTO {
        let response = try await sendAuthorized(
            HTTPRequest(path: "/instances/today", method: .get, requiresAuth: true, requiresContractV2: true)
        )
        return try decoder.decode(ChildTodayViewDTO.self, from: response.data)
    }

    func fetchChildRewards() async throws -> ChildRewardsViewDTO {
        let response = try await sendAuthorized(
            HTTPRequest(path: "/rewards", method: .get, requiresAuth: true, requiresContractV2: true)
        )
        return try decoder.decode(ChildRewardsViewDTO.self, from: response.data)
    }

    func fetchChildRedemptions() async throws -> ChildRedemptionsViewDTO {
        let response = try await sendAuthorized(
            HTTPRequest(path: "/redemptions", method: .get, requiresAuth: true, requiresContractV2: true)
        )
        return try decoder.decode(ChildRedemptionsViewDTO.self, from: response.data)
    }

    // MARK: - Mutations

    func completeInstance(id: String, idempotencyKey: String) async throws -> CompleteResultDTO {
        let response = try await sendAuthorized(
            HTTPRequest(
                path: "/instances/\(id)/complete",
                method: .post,
                requiresAuth: true,
                idempotencyKey: idempotencyKey
            )
        )
        return try decoder.decode(CompleteResultDTO.self, from: response.data)
    }

    func redeemReward(id: String, idempotencyKey: String) async throws -> RedeemResultDTO {
        let response = try await sendAuthorized(
            HTTPRequest(
                path: "/rewards/\(id)/redeem",
                method: .post,
                requiresAuth: true,
                idempotencyKey: idempotencyKey
            )
        )
        return try decoder.decode(RedeemResultDTO.self, from: response.data)
    }

    func sync(since: String?, mutations: [SyncMutationDTO]) async throws -> SyncResponseDTO {
        let body = try encoder.encode(SyncBodyDTO(since: since, mutations: mutations))
        let response = try await sendAuthorized(
            HTTPRequest(path: "/sync", method: .post, body: body, requiresAuth: true)
        )
        return try decoder.decode(SyncResponseDTO.self, from: response.data)
    }

    // MARK: - Photos

    func createUploadIntent(instanceID: String, contentType: String, bytes: Int) async throws -> UploadIntentResponseDTO {
        let payload: [String: AnyEncodable] = [
            "purpose": AnyEncodable("task"),
            "instanceId": AnyEncodable(instanceID),
            "contentType": AnyEncodable(contentType),
            "bytes": AnyEncodable(bytes),
        ]
        let body = try encoder.encode(payload)
        let response = try await sendAuthorized(
            HTTPRequest(path: "/photos/upload-intent", method: .post, body: body, requiresAuth: true)
        )
        return try decoder.decode(UploadIntentResponseDTO.self, from: response.data)
    }

    func uploadPhoto(to uploadURL: String, data: Data, contentType: String) async throws {
        guard let url = URL(string: uploadURL) else { throw HTTPTransportError.invalidURL }
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.httpBody = data
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode < 400 else {
            throw HTTPTransportError.httpStatus((response as? HTTPURLResponse)?.statusCode ?? 500, nil)
        }
    }

    func confirmPhoto(photoID: String) async throws -> PhotoStatusResponseDTO {
        let response = try await sendAuthorized(
            HTTPRequest(path: "/photos/\(photoID)/confirm", method: .post, requiresAuth: true)
        )
        return try decoder.decode(PhotoStatusResponseDTO.self, from: response.data)
    }

    func fetchPhotoStatus(photoID: String) async throws -> PhotoStatusResponseDTO {
        let response = try await sendAuthorized(
            HTTPRequest(path: "/photos/\(photoID)", method: .get, requiresAuth: true)
        )
        return try decoder.decode(PhotoStatusResponseDTO.self, from: response.data)
    }

    func attachPhoto(instanceID: String, photoID: String) async throws -> CompleteResultDTO {
        let body = try encoder.encode(["photoId": photoID])
        let response = try await sendAuthorized(
            HTTPRequest(path: "/instances/\(instanceID)/photo", method: .post, body: body, requiresAuth: true)
        )
        return try decoder.decode(CompleteResultDTO.self, from: response.data)
    }

    func registerDevice(apnsToken: String) async throws {
        let body = try encoder.encode(["apnsToken": apnsToken, "platform": "ios"])
        _ = try await sendAuthorized(
            HTTPRequest(path: "/devices", method: .post, body: body, requiresAuth: true)
        )
    }

    // MARK: - Internals

    private func sendAuthorized(_ request: HTTPRequest, retried: Bool = false) async throws -> HTTPResponse {
        let token = authStore.childSession?.accessToken ?? authStore.parentSession?.accessToken
        do {
            return try await transport.send(request, accessToken: token)
        } catch let HTTPTransportError.httpStatus(401, _) where !retried {
            if authStore.childSession != nil {
                _ = try await refreshChildSession()
            } else if let parentRefresh = authStore.parentSession?.refreshToken {
                let dto = try await refreshCoordinator.refreshParent(refreshToken: parentRefresh, transport: transport)
                authStore.updateParentTokens(accessToken: dto.accessToken, refreshToken: dto.refreshToken)
            }
            return try await sendAuthorized(request, retried: true)
        }
    }

    private func mapChildSession(_ dto: ChildSessionResultDTO, ageBand: ChildAgeBand) -> ChildSession {
        ChildSession(
            childID: dto.child.id,
            displayName: dto.child.displayName,
            avatar: AvatarCatalog.emoji(for: dto.child.avatarId),
            ageBand: ageBand,
            accessToken: dto.accessToken,
            refreshToken: dto.refreshToken
        )
    }
}

struct AnyEncodable: Encodable {
    private let encodeClosure: (Encoder) throws -> Void

    init<T: Encodable>(_ value: T) {
        encodeClosure = value.encode
    }

    func encode(to encoder: Encoder) throws {
        try encodeClosure(encoder)
    }
}
