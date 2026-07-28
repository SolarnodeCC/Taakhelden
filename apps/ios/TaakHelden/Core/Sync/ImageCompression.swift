import Foundation
import UIKit

enum ImageCompression {
    /// Target ~2 MP JPEG for photo bonus uploads (EXIF strip happens server-side).
    static func jpegData(from image: UIImage, maxPixelArea: CGFloat = 2_000_000, quality: CGFloat = 0.82) -> Data? {
        let resized = resize(image, maxPixelArea: maxPixelArea)
        return resized.jpegData(compressionQuality: quality)
    }

    private static func resize(_ image: UIImage, maxPixelArea: CGFloat) -> UIImage {
        let size = image.size
        let area = size.width * size.height
        guard area > maxPixelArea, area > 0 else { return image }

        let scale = sqrt(maxPixelArea / area)
        let newSize = CGSize(width: size.width * scale, height: size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: newSize)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: newSize))
        }
    }
}
