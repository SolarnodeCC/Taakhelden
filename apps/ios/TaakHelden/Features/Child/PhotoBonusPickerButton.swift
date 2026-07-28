import SwiftUI
import PhotosUI
import UIKit

struct PhotoBonusActionsView: View {
    let palette: THPalette
    let onJPEGData: (Data) -> Void

    @State private var pickerItem: PhotosPickerItem?
    @State private var showCamera = false
    @State private var statusMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: THSpacing.sm) {
            HStack(spacing: THSpacing.md) {
                PhotosPicker(selection: $pickerItem, matching: .images, photoLibrary: .shared()) {
                    Label("Kies een foto", systemImage: "photo")
                }
                .buttonStyle(.bordered)

                Button {
                    showCamera = true
                } label: {
                    Label("Maak een foto", systemImage: "camera")
                }
                .buttonStyle(.borderedProminent)
                .tint(palette.accent.color)
            }

            Text("We vragen alleen één foto via de camera of een systeemkiezer — geen volledige fotobibliotheek.")
                .font(.footnote)
                .foregroundStyle(palette.mutedText.color)

            if let statusMessage {
                Text(statusMessage)
                    .font(.footnote)
                    .foregroundStyle(palette.mutedText.color)
            }
        }
        .onChange(of: pickerItem) { _, newItem in
            guard let newItem else { return }
            Task { await loadPickerItem(newItem) }
        }
        .sheet(isPresented: $showCamera) {
            CameraPickerView { image in
                if let data = ImageCompression.jpegData(from: image) {
                    onJPEGData(data)
                    statusMessage = "Foto wordt nagekeken…"
                } else {
                    statusMessage = "Foto lukte niet — je mag het nog een keer proberen."
                }
            }
            .ignoresSafeArea()
        }
    }

    @MainActor
    private func loadPickerItem(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self),
              let image = UIImage(data: data),
              let jpeg = ImageCompression.jpegData(from: image) else {
            statusMessage = "Foto lukte niet — je mag het nog een keer proberen."
            return
        }
        onJPEGData(jpeg)
        statusMessage = "Foto wordt nagekeken…"
    }
}
