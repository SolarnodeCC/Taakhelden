import AuthenticationServices
import SwiftUI

struct SignInWithAppleButtonView: View {
    let onToken: (String, String?, String?) -> Void
    let onFailure: (Error) -> Void

    var body: some View {
        SignInWithAppleButton(.signIn) { request in
            request.requestedScopes = [.fullName, .email]
        } onCompletion: { result in
            switch result {
            case .success(let authorization):
                guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                      let tokenData = credential.identityToken,
                      let identityToken = String(data: tokenData, encoding: .utf8) else {
                    onFailure(AppleSignInError.missingToken)
                    return
                }
                let familyName = credential.fullName?.familyName
                let displayName = [credential.fullName?.givenName, credential.fullName?.familyName]
                    .compactMap { $0 }
                    .joined(separator: " ")
                onToken(
                    identityToken,
                    familyName?.isEmpty == false ? familyName : nil,
                    displayName.isEmpty ? nil : displayName
                )
            case .failure(let error):
                onFailure(error)
            }
        }
        .signInWithAppleButtonStyle(.black)
        .frame(height: 48)
        .accessibilityLabel("Log in met Apple")
    }
}

enum AppleSignInError: LocalizedError {
    case missingToken

    var errorDescription: String? {
        switch self {
        case .missingToken:
            return "Inloggen met Apple lukte niet. Probeer het opnieuw."
        }
    }
}
