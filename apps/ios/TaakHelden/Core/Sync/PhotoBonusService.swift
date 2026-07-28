import Foundation

@Observable
final class PhotoBonusService {
    private let apiClient: TaakHeldenAPIClient

    init(apiClient: TaakHeldenAPIClient) {
        self.apiClient = apiClient
    }

    /// Uploads JPEG bytes (~2 MP target) via intent → PUT → confirm → attach.
    func uploadTaskPhoto(instanceID: String, jpegData: Data) async throws {
        let intent = try await apiClient.createUploadIntent(
            instanceID: instanceID,
            contentType: "image/jpeg",
            bytes: jpegData.count
        )

        try await apiClient.uploadPhoto(to: intent.uploadUrl, data: jpegData, contentType: "image/jpeg")
        _ = try await apiClient.confirmPhoto(photoID: intent.photoId)

        var attempts = 0
        while attempts < 10 {
            let status = try await apiClient.fetchPhotoStatus(photoID: intent.photoId)
            if status.status == "ready" {
                _ = try await apiClient.attachPhoto(instanceID: instanceID, photoID: intent.photoId)
                return
            }
            if status.status == "failed" {
                throw PhotoBonusError.processingFailed
            }
            attempts += 1
            try await Task.sleep(nanoseconds: 500_000_000)
        }

        throw PhotoBonusError.processingTimeout
    }
}

enum PhotoBonusError: LocalizedError {
    case processingFailed
    case processingTimeout

    var errorDescription: String? {
        switch self {
        case .processingFailed:
            return "Foto lukte niet — je mag het nog een keer proberen."
        case .processingTimeout:
            return "Foto wordt nagekeken… kom zo nog even terug."
        }
    }
}
