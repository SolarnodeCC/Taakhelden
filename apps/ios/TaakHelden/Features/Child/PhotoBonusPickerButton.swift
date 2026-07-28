import SwiftUI
import PhotosUI

struct PhotoBonusPickerButton: View {
    let palette: THPalette
    let onJPEGData: (Data) -> Void

    @State private var pickerItem: PhotosPickerItem?

    var body: some View {
        PhotosPicker(selection: $pickerItem, matching: .images, photoLibrary: .shared()) {
            Label("Kies een foto", systemImage: "photo")
        }
        .onChange(of: pickerItem) { _, newItem in
            guard let newItem else { return }
            Task {
                if let data = try? await newItem.loadTransferable(type: Data.self) {
                    onJPEGData(data)
                }
            }
        }

        // Camera path uses UIImagePickerController wrapper in a follow-up UI pass;
        // Phase 1 keeps out-of-process picker only to avoid full library access.
    }
}
