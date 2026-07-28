import Foundation

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case patch = "PATCH"
    case delete = "DELETE"
    case put = "PUT"
}

struct HTTPRequest {
    var path: String
    var method: HTTPMethod = .get
    var body: Data?
    var headers: [String: String] = [:]
    var requiresAuth = false
    var requiresContractV2 = false
    var idempotencyKey: String?
}

struct HTTPResponse {
    let statusCode: Int
    let data: Data
    let headers: [AnyHashable: Any]
}

protocol HTTPTransporting {
    func send(_ request: HTTPRequest, accessToken: String?) async throws -> HTTPResponse
}

enum HTTPTransportError: LocalizedError {
    case invalidURL
    case transport(Error)
    case httpStatus(Int, APIErrorEnvelope?)
    case decoding(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "De verbinding kon niet worden opgezet."
        case .transport:
            return "We kunnen even geen verbinding maken — je afgevinkte taken zijn veilig."
        case .httpStatus(_, let envelope):
            return envelope?.error.message ?? "Er ging iets mis. Probeer het gerust opnieuw."
        case .decoding:
            return "Het antwoord was onverwacht. Probeer het zo nog een keer."
        }
    }
}

final class URLSessionTransport: HTTPTransporting {
    private let baseURL: URL
    private let session: URLSession
    private let decoder = JSONDecoder()

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func send(_ request: HTTPRequest, accessToken: String?) async throws -> HTTPResponse {
        guard let url = URL(string: request.path, relativeTo: baseURL) else {
            throw HTTPTransportError.invalidURL
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = request.method.rawValue
        urlRequest.httpBody = request.body
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if request.requiresContractV2 {
            urlRequest.setValue(ContractSource.contractVersionHeader, forHTTPHeaderField: "X-Contract-Version")
        }

        if let accessToken, request.requiresAuth {
            urlRequest.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }

        if let idempotencyKey = request.idempotencyKey {
            urlRequest.setValue(idempotencyKey, forHTTPHeaderField: "Idempotency-Key")
        }

        for (key, value) in request.headers {
            urlRequest.setValue(value, forHTTPHeaderField: key)
        }

        do {
            let (data, response) = try await session.data(for: urlRequest)
            guard let http = response as? HTTPURLResponse else {
                throw HTTPTransportError.transport(URLError(.badServerResponse))
            }

            let envelope = try? decoder.decode(APIErrorEnvelope.self, from: data)
            if http.statusCode >= 400 {
                throw HTTPTransportError.httpStatus(http.statusCode, envelope)
            }

            return HTTPResponse(statusCode: http.statusCode, data: data, headers: http.allHeaderFields)
        } catch let error as HTTPTransportError {
            throw error
        } catch {
            throw HTTPTransportError.transport(error)
        }
    }
}

extension JSONDecoder {
    static let apiDecoder: JSONDecoder = {
        let decoder = JSONDecoder()
        return decoder
    }()
}

extension JSONEncoder {
    static let apiEncoder: JSONEncoder = {
        let encoder = JSONEncoder()
        return encoder
    }()
}
