import Foundation

@Observable
final class TaakHeldenAPIClient {
    let transport: HTTPTransporting
    let authStore: AuthStore
    let refreshCoordinator: TokenRefreshCoordinator
    let decoder = JSONDecoder.apiDecoder
    let encoder = JSONEncoder.apiEncoder

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
                    ageBand: AvatarCatalog.ageBand(from: $0.ageMode)
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
        return mapChildSession(dto)
    }

    func refreshChildSession() async throws -> ChildSession {
        guard let refreshToken = authStore.childSession?.refreshToken else {
            throw APIClientError.sessionMissing
        }
        let dto = try await refreshCoordinator.refreshChild(refreshToken: refreshToken, transport: transport)
        let session = mapChildSession(dto)
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
        let response = try await sendAsParent(
            HTTPRequest(path: "/members/children", method: .post, body: body, requiresAuth: true)
        )
        return try decoder.decode(MemberViewDTO.self, from: response.data)
    }

    func fetchParentFamily() async throws -> ParentFamilyViewDTO {
        let response = try await sendAsParent(
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

    /// Pin a reward as the child's spaardoel (online-only; not a sync mutation).
    func pinReward(id: String) async throws -> PinRewardResultDTO {
        let response = try await sendAuthorized(
            HTTPRequest(path: "/rewards/\(id)/pin", method: .post, requiresAuth: true)
        )
        return try decoder.decode(PinRewardResultDTO.self, from: response.data)
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

    // MARK: - Phase 3: avatar shop + family goals

    func fetchAvatarCatalog() async throws -> AvatarCatalogResponseDTO {
        let response = try await sendAuthorized(
            HTTPRequest(path: "/avatar/catalog", method: .get, requiresAuth: true)
        )
        return try decoder.decode(AvatarCatalogResponseDTO.self, from: response.data)
    }

    func fetchMemberAvatar(memberID: String) async throws -> MemberAvatarStateDTO {
        let response = try await sendAuthorized(
            HTTPRequest(path: "/members/\(memberID)/avatar", method: .get, requiresAuth: true)
        )
        return try decoder.decode(MemberAvatarStateDTO.self, from: response.data)
    }

    func equipAvatar(
        memberID: String,
        hat: OptionalNullString = .omit,
        background: OptionalNullString = .omit,
        accessory: OptionalNullString = .omit,
        idempotencyKey: String
    ) async throws -> MemberAvatarStateDTO {
        let payload = EquipAvatarPayload(hat: hat, background: background, accessory: accessory)
        let body = try encoder.encode(payload)
        let response = try await sendAuthorized(
            HTTPRequest(
                path: "/members/\(memberID)/avatar",
                method: .patch,
                body: body,
                requiresAuth: true,
                idempotencyKey: idempotencyKey
            )
        )
        return try decoder.decode(MemberAvatarStateDTO.self, from: response.data)
    }

    func fetchActiveFamilyGoalProgress() async throws -> FamilyGoalProgressResponseDTO {
        let response = try await sendAuthorized(
            HTTPRequest(path: "/families/me/goals/active/progress", method: .get, requiresAuth: true)
        )
        return try decoder.decode(FamilyGoalProgressResponseDTO.self, from: response.data)
    }

    func createFamilyGoal(title: String, icon: String, targetPoints: Int, childIds: [String], idempotencyKey: String) async throws -> FamilyGoalDTO {
        let payload: [String: AnyEncodable] = [
            "title": AnyEncodable(title),
            "icon": AnyEncodable(icon),
            "targetPoints": AnyEncodable(targetPoints),
            "childIds": AnyEncodable(childIds),
        ]
        let body = try encoder.encode(payload)
        let response = try await sendAsParent(
            HTTPRequest(
                path: "/families/me/goals",
                method: .post,
                body: body,
                requiresAuth: true,
                idempotencyKey: idempotencyKey
            )
        )
        return try decoder.decode(FamilyGoalDTO.self, from: response.data)
    }

    // MARK: - Internals

    /// Child-session token only. Parent ops must use `sendAsParent`.
    func sendAsChild(_ request: HTTPRequest, retried: Bool = false) async throws -> HTTPResponse {
        guard let token = authStore.childSession?.accessToken else {
            throw APIClientError.sessionMissing
        }
        do {
            return try await transport.send(request, accessToken: token)
        } catch let HTTPTransportError.httpStatus(401, _) where !retried {
            _ = try await refreshChildSession()
            return try await sendAsChild(request, retried: true)
        }
    }

    /// Prefer child token when present (child home path); otherwise parent.
    /// Do not use for parent-only endpoints — use `sendAsParent`.
    private func sendAuthorized(_ request: HTTPRequest, retried: Bool = false) async throws -> HTTPResponse {
        if authStore.childSession != nil {
            return try await sendAsChild(request, retried: retried)
        }
        return try await sendAsParent(request, retried: retried)
    }

    private func mapChildSession(_ dto: ChildSessionResultDTO) -> ChildSession {
        ChildSession(
            childID: dto.child.id,
            displayName: dto.child.displayName,
            avatar: AvatarCatalog.emoji(for: dto.child.avatarId),
            ageBand: AvatarCatalog.ageBand(from: dto.child.ageMode),
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

/// Distinguishes omit vs explicit null for equip PATCH bodies.
enum OptionalNullString: Equatable {
    case omit
    case value(String?)
}

/// Response from `POST /rewards/{id}/pin` (not yet in OpenAPI snapshot).
struct PinRewardResultDTO: Codable, Equatable {
    let rewardId: String
    let title: String
    let price: Int
    let progress: Double
}

struct EquipAvatarPayload: Encodable, Equatable {
    let hat: OptionalNullString
    let background: OptionalNullString
    let accessory: OptionalNullString

    enum CodingKeys: String, CodingKey {
        case hat, background, accessory
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try encodeSlot(&container, key: .hat, value: hat)
        try encodeSlot(&container, key: .background, value: background)
        try encodeSlot(&container, key: .accessory, value: accessory)
    }

    private func encodeSlot(
        _ container: inout KeyedEncodingContainer<CodingKeys>,
        key: CodingKeys,
        value: OptionalNullString
    ) throws {
        switch value {
        case .omit:
            break
        case .value(let string):
            try container.encode(string, forKey: key)
        }
    }
}
