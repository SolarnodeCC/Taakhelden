import Foundation

// MARK: - Parent HTTP surface (live Worker)

extension TaakHeldenAPIClient {
    func fetchParentToday() async throws -> ParentTodayViewDTO {
        let response = try await sendAsParent(
            HTTPRequest(path: "/instances/today", method: .get, requiresAuth: true, requiresContractV2: true)
        )
        return try decoder.decode(ParentTodayViewDTO.self, from: response.data)
    }

    func approveInstance(id: String, idempotencyKey: String) async throws -> EmptyJSON {
        let response = try await sendAsParent(
            HTTPRequest(
                path: "/instances/\(id)/approve",
                method: .post,
                requiresAuth: true,
                idempotencyKey: idempotencyKey
            )
        )
        return (try? decoder.decode(EmptyJSON.self, from: response.data)) ?? EmptyJSON()
    }

    func redoInstance(id: String, note: String, idempotencyKey: String) async throws -> EmptyJSON {
        let body = try encoder.encode(["note": note])
        let response = try await sendAsParent(
            HTTPRequest(
                path: "/instances/\(id)/redo",
                method: .post,
                body: body,
                requiresAuth: true,
                idempotencyKey: idempotencyKey
            )
        )
        return (try? decoder.decode(EmptyJSON.self, from: response.data)) ?? EmptyJSON()
    }

    func fetchParentTasks() async throws -> [ParentTaskManageDTO] {
        let response = try await sendAsParent(
            HTTPRequest(path: "/tasks", method: .get, requiresAuth: true)
        )
        return try decoder.decode([ParentTaskManageDTO].self, from: response.data)
    }

    func createTask(title: String, points: Int, assignees: [String], idempotencyKey: String) async throws -> ParentTaskManageDTO {
        let payload: [String: AnyEncodable] = [
            "title": AnyEncodable(title),
            "points": AnyEncodable(points),
            "assignees": AnyEncodable(assignees),
            "category": AnyEncodable("household"),
            "icon": AnyEncodable("star"),
        ]
        let body = try encoder.encode(payload)
        let response = try await sendAsParent(
            HTTPRequest(
                path: "/tasks",
                method: .post,
                body: body,
                requiresAuth: true,
                idempotencyKey: idempotencyKey
            )
        )
        return try decoder.decode(ParentTaskManageDTO.self, from: response.data)
    }

    func archiveTask(id: String) async throws {
        _ = try await sendAsParent(
            HTTPRequest(
                path: "/tasks/\(id)",
                method: .delete,
                requiresAuth: true,
                idempotencyKey: IdempotencyKey.forTaskArchive(taskID: id)
            )
        )
    }

    func fetchParentRewards() async throws -> [ParentRewardManageDTO] {
        let response = try await sendAsParent(
            HTTPRequest(path: "/rewards", method: .get, requiresAuth: true, requiresContractV2: true)
        )
        if let wrapped = try? decoder.decode(ParentRewardsViewDTO.self, from: response.data) {
            return wrapped.rewards
        }
        return try decoder.decode([ParentRewardManageDTO].self, from: response.data)
    }

    func createReward(title: String, price: Int, idempotencyKey: String) async throws -> ParentRewardManageDTO {
        let payload: [String: AnyEncodable] = [
            "title": AnyEncodable(title),
            "price": AnyEncodable(price),
            "icon": AnyEncodable("gift"),
        ]
        let body = try encoder.encode(payload)
        let response = try await sendAsParent(
            HTTPRequest(
                path: "/rewards",
                method: .post,
                body: body,
                requiresAuth: true,
                idempotencyKey: idempotencyKey
            )
        )
        return try decoder.decode(ParentRewardManageDTO.self, from: response.data)
    }

    func archiveReward(id: String) async throws {
        _ = try await sendAsParent(
            HTTPRequest(
                path: "/rewards/\(id)",
                method: .delete,
                requiresAuth: true,
                idempotencyKey: IdempotencyKey.forRewardArchive(rewardID: id)
            )
        )
    }

    func mintFamilyRoomToken() async throws -> WsTokenDTO {
        let response = try await sendAsParent(
            HTTPRequest(path: "/ws/token", method: .post, requiresAuth: true)
        )
        return try decoder.decode(WsTokenDTO.self, from: response.data)
    }

    func startAccountExport() async throws -> ExportJobDTO {
        let response = try await sendAsParent(
            HTTPRequest(path: "/account/export", method: .post, requiresAuth: true)
        )
        return try decoder.decode(ExportJobDTO.self, from: response.data)
    }

    func fetchAccountExport(id: String) async throws -> ExportJobDTO {
        let response = try await sendAsParent(
            HTTPRequest(path: "/account/export/\(id)", method: .get, requiresAuth: true)
        )
        return try decoder.decode(ExportJobDTO.self, from: response.data)
    }

    func deleteAccount(appleIdentityToken: String) async throws -> AccountDeleteResultDTO {
        let body = try encoder.encode(["appleIdentityToken": appleIdentityToken])
        let response = try await sendAsParent(
            HTTPRequest(path: "/account", method: .delete, body: body, requiresAuth: true)
        )
        return try decoder.decode(AccountDeleteResultDTO.self, from: response.data)
    }

    func sendAsParent(_ request: HTTPRequest, retried: Bool = false) async throws -> HTTPResponse {
        guard let token = authStore.parentSession?.accessToken else {
            throw APIClientError.parentSessionMissing
        }
        do {
            return try await transport.send(request, accessToken: token)
        } catch let HTTPTransportError.httpStatus(401, _) where !retried {
            guard let parentRefresh = authStore.parentSession?.refreshToken else {
                throw APIClientError.parentSessionMissing
            }
            let dto = try await refreshCoordinator.refreshParent(refreshToken: parentRefresh, transport: transport)
            authStore.updateParentTokens(accessToken: dto.accessToken, refreshToken: dto.refreshToken)
            return try await sendAsParent(request, retried: true)
        }
    }
}

struct EmptyJSON: Codable {}

struct ParentTodayChildDTO: Codable, Equatable {
    let childId: String
    let displayName: String
    let avatarId: String?
    let instances: [InstanceViewDTO]
    let balance: TodayBalanceDTO
}

struct ParentTodayViewDTO: Codable, Equatable {
    let viewer: String
    let date: String
    let children: [ParentTodayChildDTO]
}

struct ParentTaskManageDTO: Codable, Equatable, Identifiable {
    let id: String
    let title: String
    let icon: String?
    let points: Int
    let assignees: [String]
}

struct ParentRewardManageDTO: Codable, Equatable, Identifiable {
    let id: String
    let title: String
    let icon: String?
    let price: Int
}

struct ParentRewardsViewDTO: Codable {
    let viewer: String
    let rewards: [ParentRewardManageDTO]
}

struct WsTokenDTO: Codable {
    let token: String
    let expiresIn: Int
}

struct ExportJobDTO: Codable {
    let exportId: String
    let status: String
    let downloadUrl: String?
}

struct AccountDeleteResultDTO: Codable {
    let deletedAt: String
    let purgeAfter: String
}
