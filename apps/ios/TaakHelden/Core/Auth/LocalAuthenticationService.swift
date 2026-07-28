import Foundation
import LocalAuthentication

protocol LocalAuthenticationClient {
    func canEvaluateBiometrics() -> Bool
    func evaluateBiometrics(reason: String) async throws -> Bool
}

enum LocalAuthenticationError: LocalizedError {
    case unavailable
    case cancelled

    var errorDescription: String? {
        switch self {
        case .unavailable:
            return "Face ID is nu niet beschikbaar. Gebruik je pincode."
        case .cancelled:
            return "Geen probleem — je kunt je pincode gebruiken."
        }
    }
}

final class SystemLocalAuthenticationClient: LocalAuthenticationClient {
    func canEvaluateBiometrics() -> Bool {
        var error: NSError?
        let context = LAContext()
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }

    func evaluateBiometrics(reason: String) async throws -> Bool {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            throw LocalAuthenticationError.unavailable
        }

        return try await withCheckedThrowingContinuation { continuation in
            context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, authError in
                if let authError {
                    if (authError as NSError).code == LAError.userCancel.rawValue
                        || (authError as NSError).code == LAError.appCancel.rawValue {
                        continuation.resume(throwing: LocalAuthenticationError.cancelled)
                    } else {
                        continuation.resume(throwing: authError)
                    }
                    return
                }
                continuation.resume(returning: success)
            }
        }
    }
}
