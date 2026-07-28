import Foundation

actor TokenRefreshCoordinator {
    private var childRefreshTask: Task<ChildSessionResultDTO, Error>?
    private var parentRefreshTask: Task<ParentSessionResultDTO, Error>?

    func refreshChild(
        refreshToken: String,
        transport: HTTPTransporting
    ) async throws -> ChildSessionResultDTO {
        if let existing = childRefreshTask {
            return try await existing.value
        }

        let task = Task {
            defer { childRefreshTask = nil }
            let body = try JSONEncoder.apiEncoder.encode(["refreshToken": refreshToken])
            let response = try await transport.send(
                HTTPRequest(path: "/auth/child-session/refresh", method: .post, body: body),
                accessToken: nil
            )
            return try JSONDecoder.apiDecoder.decode(ChildSessionResultDTO.self, from: response.data)
        }

        childRefreshTask = task
        return try await task.value
    }

    func refreshParent(
        refreshToken: String,
        transport: HTTPTransporting
    ) async throws -> ParentSessionResultDTO {
        if let existing = parentRefreshTask {
            return try await existing.value
        }

        let task = Task {
            defer { parentRefreshTask = nil }
            let body = try JSONEncoder.apiEncoder.encode(["refreshToken": refreshToken])
            let response = try await transport.send(
                HTTPRequest(path: "/auth/refresh", method: .post, body: body),
                accessToken: nil
            )
            return try JSONDecoder.apiDecoder.decode(ParentSessionResultDTO.self, from: response.data)
        }

        parentRefreshTask = task
        return try await task.value
    }
}
