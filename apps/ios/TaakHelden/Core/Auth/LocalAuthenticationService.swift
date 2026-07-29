import Foundation
import LocalAuthentication

protocol LocalAuthenticationClient {
    func canEvaluateBiometrics() -> Bool
    func canEvaluateDeviceOwner() -> Bool
    /// Prefer device-owner auth (biometrics **or** device passcode) for parental gate.
    func evaluateDeviceOwner(reason: String) async throws -> Bool
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

    func canEvaluateDeviceOwner() -> Bool {
        var error: NSError?
        let context = LAContext()
        return context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
    }

    func evaluateDeviceOwner(reason: String) async throws -> Bool {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            throw LocalAuthenticationError.unavailable
        }

        return try await withCheckedThrowingContinuation { continuation in
            context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, authError in
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

struct PreviewLocalAuthenticationClient: LocalAuthenticationClient {
    var shouldSucceed = true

    func canEvaluateBiometrics() -> Bool { true }
    func canEvaluateDeviceOwner() -> Bool { true }

    func evaluateDeviceOwner(reason: String) async throws -> Bool {
        if shouldSucceed { return true }
        throw LocalAuthenticationError.unavailable
    }

    func evaluateBiometrics(reason: String) async throws -> Bool {
        try await evaluateDeviceOwner(reason: reason)
    }
}
