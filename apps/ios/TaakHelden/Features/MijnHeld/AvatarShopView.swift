import Foundation
import SwiftUI

enum AvatarSlotFilter: String, CaseIterable, Identifiable {
    case hat
    case background
    case accessory

    var id: String { rawValue }

    var titleKey: LocalizedStringKey {
        switch self {
        case .hat: "held.avatar.slot.hat"
        case .background: "held.avatar.slot.background"
        case .accessory: "held.avatar.slot.accessory"
        }
    }
}

@Observable
@MainActor
final class AvatarShopViewModel {
    private let apiClient: TaakHeldenAPIClient
    private let memberID: String
    /// Stable Idempotency-Key per equip intent until success (retry-safe).
    private var pendingEquipKeys: [String: String] = [:]

    var catalog: [AvatarCatalogItemDTO] = []
    var state: MemberAvatarStateDTO?
    var isLoading = false
    var isEquipping = false
    var errorMessage: String?
    var selectedSlot: AvatarSlotFilter = .hat

    init(apiClient: TaakHeldenAPIClient, memberID: String) {
        self.apiClient = apiClient
        self.memberID = memberID
    }

    var itemsForSelectedSlot: [AvatarCatalogItemDTO] {
        catalog
            .filter { $0.slot == selectedSlot.rawValue }
            .sorted { $0.sortOrder < $1.sortOrder }
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            async let catalogTask = apiClient.fetchAvatarCatalog()
            async let stateTask = apiClient.fetchMemberAvatar(memberID: memberID)
            catalog = try await catalogTask.items
            state = try await stateTask
        } catch {
            errorMessage = String(localized: "held.avatar.load.error")
        }
    }

    func isUnlocked(_ item: AvatarCatalogItemDTO) -> Bool {
        state?.unlocked.contains(item.id) == true
    }

    func isEquipped(_ item: AvatarCatalogItemDTO) -> Bool {
        guard let state else { return false }
        switch item.slot {
        case AvatarSlotFilter.hat.rawValue: return state.equipped.hat == item.id
        case AvatarSlotFilter.background.rawValue: return state.equipped.background == item.id
        case AvatarSlotFilter.accessory.rawValue: return state.equipped.accessory == item.id
        default: return false
        }
    }

    func equip(_ item: AvatarCatalogItemDTO) async {
        guard isUnlocked(item), !isEquipping else { return }
        isEquipping = true
        defer { isEquipping = false }

        let key = pendingEquipKeys[item.id] ?? UUID().uuidString
        pendingEquipKeys[item.id] = key

        do {
            switch item.slot {
            case AvatarSlotFilter.hat.rawValue:
                state = try await apiClient.equipAvatar(
                    memberID: memberID,
                    hat: .value(item.id),
                    idempotencyKey: key
                )
            case AvatarSlotFilter.background.rawValue:
                state = try await apiClient.equipAvatar(
                    memberID: memberID,
                    background: .value(item.id),
                    idempotencyKey: key
                )
            case AvatarSlotFilter.accessory.rawValue:
                state = try await apiClient.equipAvatar(
                    memberID: memberID,
                    accessory: .value(item.id),
                    idempotencyKey: key
                )
            default:
                return
            }
            pendingEquipKeys.removeValue(forKey: item.id)
            errorMessage = nil
        } catch {
            errorMessage = String(localized: "held.avatar.equip.error")
        }
    }

    /// Test seam: pending key for an item after a failed/incomplete equip.
    func pendingKey(for itemID: String) -> String? {
        pendingEquipKeys[itemID]
    }
}

struct AvatarShopView: View {
    @Bindable var viewModel: AvatarShopViewModel
    let palette: THPalette
    let baseAvatar: String
    let isYoung: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: THSpacing.lg) {
            preview
            Picker(String(localized: "held.avatar.slot"), selection: $viewModel.selectedSlot) {
                ForEach(AvatarSlotFilter.allCases) { slot in
                    Text(slot.titleKey).tag(slot)
                }
            }
            .pickerStyle(.segmented)

            if viewModel.isLoading {
                ProgressView(String(localized: "held.avatar.loading"))
            } else if let error = viewModel.errorMessage, viewModel.catalog.isEmpty {
                VStack(alignment: .leading, spacing: THSpacing.sm) {
                    Text(error).foregroundStyle(palette.mutedText.color)
                    Button(String(localized: "child.retry")) {
                        Task { await viewModel.load() }
                    }
                    .buttonStyle(.bordered)
                    .frame(minHeight: isYoung ? YoungModeSupport.minTapTarget : 44)
                }
            } else {
                if let error = viewModel.errorMessage {
                    Text(error).foregroundStyle(palette.mutedText.color)
                }
                ForEach(viewModel.itemsForSelectedSlot) { item in
                    itemRow(item)
                }
            }
        }
        .task { await viewModel.load() }
    }

    private var preview: some View {
        THCard(palette: palette) {
            HStack(spacing: THSpacing.md) {
                Text(composedEmoji)
                    .font(.system(size: isYoung ? 72 : 56))
                    .accessibilityLabel(Text("held.avatar.preview"))
                VStack(alignment: .leading) {
                    Text(LocalizedStringKey("held.avatar.title"))
                        .font(.headline)
                        .foregroundStyle(palette.text.color)
                    if let state = viewModel.state {
                        Text(String(format: String(localized: "held.level.format"), state.level))
                            .foregroundStyle(palette.mutedText.color)
                    }
                }
                if isYoung, let state = viewModel.state {
                    YoungSpeakButton(
                        text: String(format: String(localized: "held.level.speak"), state.level),
                        palette: palette
                    )
                }
            }
        }
    }

    private var composedEmoji: String {
        guard let state = viewModel.state else { return baseAvatar }
        let hat = catalogEmoji(state.equipped.hat)
        let accessory = catalogEmoji(state.equipped.accessory)
        return [hat, baseAvatar, accessory].compactMap { $0 }.joined()
    }

    private func catalogEmoji(_ id: String?) -> String? {
        guard let id else { return nil }
        return viewModel.catalog.first(where: { $0.id == id })?.previewEmoji
    }

    @ViewBuilder
    private func itemRow(_ item: AvatarCatalogItemDTO) -> some View {
        let unlocked = viewModel.isUnlocked(item)
        let equipped = viewModel.isEquipped(item)
        THCard(palette: palette) {
            HStack {
                Text(item.previewEmoji)
                    .font(.system(size: isYoung ? 40 : 28))
                    .accessibilityHidden(true)
                VStack(alignment: .leading) {
                    Text(item.title)
                        .foregroundStyle(palette.text.color)
                    Text(unlocked
                         ? String(localized: "held.avatar.unlocked")
                         : unlockHint(item))
                        .font(.footnote)
                        .foregroundStyle(palette.mutedText.color)
                }
                Spacer()
                if unlocked {
                    Button(equipped
                           ? String(localized: "held.avatar.equipped")
                           : String(localized: "held.avatar.equip")) {
                        Task { await viewModel.equip(item) }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(palette.accent.color)
                    .disabled(equipped || viewModel.isEquipping)
                    .frame(minHeight: isYoung ? YoungModeSupport.minTapTarget : 44)
                }
            }
            .opacity(unlocked ? 1 : 0.75)
            .accessibilityElement(children: .combine)
        }
    }

    private func unlockHint(_ item: AvatarCatalogItemDTO) -> String {
        switch item.unlockType {
        case "level":
            return String(format: String(localized: "held.avatar.unlock.level"), item.unlockThreshold)
        case "lifetimePoints":
            return String(format: String(localized: "held.avatar.unlock.points"), item.unlockThreshold)
        case "badge":
            return String(localized: "held.avatar.unlock.badge")
        default:
            return String(localized: "held.avatar.unlock.soon")
        }
    }
}
