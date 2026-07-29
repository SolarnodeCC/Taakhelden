import Foundation

enum FamilyRoomConnectionState: Equatable {
    case disconnected
    case connecting
    case connected
    case waitingToReconnect(seconds: Int)
}

enum FamilyRoomEvent: Equatable {
    case approvalsChanged
    case todayChanged
    case settingsChanged
    case pointsChanged
    case redemptionsChanged
}

struct FamilyRoomReconnectPolicy: Equatable {
    let delaysInSeconds: [Int]

    static let parentDefault = FamilyRoomReconnectPolicy(delaysInSeconds: [2, 4, 8])

    func delay(forAttempt attempt: Int) -> Int {
        guard let firstDelay = delaysInSeconds.first else {
            return 0
        }

        guard attempt > 0 else {
            return firstDelay
        }

        let index = min(attempt, delaysInSeconds.count - 1)
        return delaysInSeconds[index]
    }
}

protocol FamilyRoomClient: AnyObject {
    func connect(
        onStatusChange: @escaping @Sendable (FamilyRoomConnectionState) -> Void,
        onEvent: @escaping @Sendable (FamilyRoomEvent) -> Void
    )
    func disconnect()
}

final class PreviewFamilyRoomClient: FamilyRoomClient {
    private var onStatusChange: ((FamilyRoomConnectionState) -> Void)?
    private var onEvent: ((FamilyRoomEvent) -> Void)?

    func connect(
        onStatusChange: @escaping @Sendable (FamilyRoomConnectionState) -> Void,
        onEvent: @escaping @Sendable (FamilyRoomEvent) -> Void
    ) {
        self.onStatusChange = onStatusChange
        self.onEvent = onEvent

        onStatusChange(.connecting)
        onStatusChange(.connected)
    }

    func disconnect() {
        onStatusChange?(.disconnected)
        onStatusChange = nil
        onEvent = nil
    }

    func simulateEvent(_ event: FamilyRoomEvent) {
        onEvent?(event)
    }

    func simulateReconnect(attempt: Int, policy: FamilyRoomReconnectPolicy = .parentDefault) {
        onStatusChange?(.waitingToReconnect(seconds: policy.delay(forAttempt: attempt)))
    }
}

/// Live FamilyRoom client — parent JWT → short-lived WS token → URLSessionWebSocketTask.
final class LiveFamilyRoomClient: FamilyRoomClient, @unchecked Sendable {
    private let apiClient: TaakHeldenAPIClient
    private let baseURL: URL
    private let policy: FamilyRoomReconnectPolicy

    private var task: URLSessionWebSocketTask?
    private var session: URLSession?
    private var onStatusChange: (@Sendable (FamilyRoomConnectionState) -> Void)?
    private var onEvent: (@Sendable (FamilyRoomEvent) -> Void)?
    private var reconnectAttempt = 0
    private var shouldRun = false
    private let lock = NSLock()

    init(
        apiClient: TaakHeldenAPIClient,
        baseURL: URL,
        policy: FamilyRoomReconnectPolicy = .parentDefault
    ) {
        self.apiClient = apiClient
        self.baseURL = baseURL
        self.policy = policy
    }

    func connect(
        onStatusChange: @escaping @Sendable (FamilyRoomConnectionState) -> Void,
        onEvent: @escaping @Sendable (FamilyRoomEvent) -> Void
    ) {
        lock.lock()
        self.onStatusChange = onStatusChange
        self.onEvent = onEvent
        shouldRun = true
        reconnectAttempt = 0
        lock.unlock()

        Task { await openConnection() }
    }

    func disconnect() {
        lock.lock()
        shouldRun = false
        let activeTask = task
        task = nil
        session = nil
        let status = onStatusChange
        lock.unlock()

        activeTask?.cancel(with: .goingAway, reason: nil)
        status?(.disconnected)
    }

    private func openConnection() async {
        lock.lock()
        let running = shouldRun
        let statusHandler = onStatusChange
        lock.unlock()
        guard running else { return }

        statusHandler?(.connecting)

        do {
            let token = try await apiClient.mintFamilyRoomToken()
            guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
                scheduleReconnect()
                return
            }
            // baseURL is …/v1 — WS path is /v1/ws
            let path = components.path.hasSuffix("/") ? String(components.path.dropLast()) : components.path
            components.path = "\(path)/ws"
            components.queryItems = [URLQueryItem(name: "token", value: token.token)]
            guard let wsURL = components.url else {
                scheduleReconnect()
                return
            }

            let session = URLSession(configuration: .default)
            let task = session.webSocketTask(with: wsURL)
            lock.lock()
            self.session = session
            self.task = task
            lock.unlock()

            task.resume()
            lock.lock()
            reconnectAttempt = 0
            lock.unlock()
            startPingLoop(task)
            await receiveLoop(task, markConnectedOnFirstReceive: true)
        } catch {
            scheduleReconnect()
        }
    }

    private func startPingLoop(_ task: URLSessionWebSocketTask) {
        Task { [weak self] in
            while true {
                guard let self else { return }
                self.lock.lock()
                let running = self.shouldRun
                self.lock.unlock()
                guard running else { return }

                try? await Task.sleep(nanoseconds: 25_000_000_000)
                self.lock.lock()
                let stillRunning = self.shouldRun
                let active = self.task
                self.lock.unlock()
                guard stillRunning, active === task else { return }

                do {
                    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                        task.sendPing { error in
                            if let error {
                                continuation.resume(throwing: error)
                            } else {
                                continuation.resume()
                            }
                        }
                    }
                } catch {
                    self.scheduleReconnect()
                    return
                }
            }
        }
    }

    private func receiveLoop(_ task: URLSessionWebSocketTask, markConnectedOnFirstReceive: Bool) async {
        var announcedConnected = !markConnectedOnFirstReceive
        while true {
            lock.lock()
            let running = shouldRun
            let statusHandler = onStatusChange
            lock.unlock()
            guard running else { return }

            do {
                let message = try await task.receive()
                if !announcedConnected {
                    announcedConnected = true
                    statusHandler?(.connected)
                }
                switch message {
                case .string(let text):
                    handleMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        handleMessage(text)
                    }
                @unknown default:
                    break
                }
            } catch {
                scheduleReconnect()
                return
            }
        }
    }

    private func handleMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let event = json["event"] as? String else {
            return
        }

        let mapped: FamilyRoomEvent
        switch event {
        case "instance.updated":
            mapped = .approvalsChanged
        case "points.changed":
            mapped = .pointsChanged
        case "redemption.created", "redemption.updated":
            mapped = .redemptionsChanged
        case "badge.earned":
            mapped = .todayChanged
        default:
            mapped = .todayChanged
        }

        lock.lock()
        let handler = onEvent
        lock.unlock()
        handler?(mapped)
    }

    private func scheduleReconnect() {
        lock.lock()
        guard shouldRun else {
            lock.unlock()
            return
        }
        let attempt = reconnectAttempt
        reconnectAttempt += 1
        let delay = policy.delay(forAttempt: attempt)
        let statusHandler = onStatusChange
        lock.unlock()

        statusHandler?(.waitingToReconnect(seconds: delay))
        Task {
            try? await Task.sleep(nanoseconds: UInt64(delay) * 1_000_000_000)
            await openConnection()
        }
    }
}
