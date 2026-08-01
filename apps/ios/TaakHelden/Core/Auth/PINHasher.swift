import CryptoKit
import Foundation
import Security

/// Hashes and verifies child PINs using a device-unique random salt + SHA-256.
///
/// Stored layout (64 bytes):
///   [0 ..< 32]  random salt (generated once per store call)
///   [32 ..< 64] SHA-256(salt ‖ PIN-UTF8)
///
/// No raw PIN is ever written to the Keychain.  A stored blob whose length
/// does not equal exactly 64 bytes (e.g. a legacy UTF-8 plaintext PIN) is
/// treated as invalid, causing `verify` to return false.
enum PINHasher {
    static let saltLength = 32
    static let hashLength = SHA256.Digest.byteCount  // SHA-256 output = 32 bytes

    /// Creates a fresh 64-byte salt+hash blob for `pin`.
    /// Call this every time a new PIN is stored (e.g. after pairing).
    static func makeStored(pin: String) -> Data {
        var saltBytes = [UInt8](repeating: 0, count: saltLength)
        _ = SecRandomCopyBytes(kSecRandomDefault, saltLength, &saltBytes)
        let salt = Data(saltBytes)
        return salt + digest(pin: pin, salt: salt)
    }

    /// Returns `true` iff `pin` matches the blob produced by `makeStored`.
    /// Returns `false` for any blob that is not exactly 64 bytes.
    static func verify(pin: String, stored: Data) -> Bool {
        guard stored.count == saltLength + hashLength else { return false }
        let salt = Data(stored.prefix(saltLength))
        let storedHash = Data(stored.suffix(hashLength))
        return digest(pin: pin, salt: salt) == storedHash
    }

    // MARK: - Private

    private static func digest(pin: String, salt: Data) -> Data {
        var hasher = SHA256()
        hasher.update(data: salt)
        hasher.update(data: Data(pin.utf8))
        return Data(hasher.finalize())
    }
}
