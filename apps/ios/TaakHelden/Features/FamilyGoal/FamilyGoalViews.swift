import Foundation
import SwiftUI

@Observable
@MainActor
final class FamilyGoalViewModel {
    private let apiClient: TaakHeldenAPIClient
    var progress: FamilyGoalProgressDTO?
    var isLoading = false

    init(apiClient: TaakHeldenAPIClient) {
        self.apiClient = apiClient
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        progress = try? await apiClient.fetchActiveFamilyGoalProgress().progress
    }
}

struct FamilyGoalCard: View {
    let progress: FamilyGoalProgressDTO
    let palette: THPalette
    let isYoung: Bool
    let isTeen: Bool

    private var fraction: Double {
        guard progress.targetPoints > 0 else { return 0 }
        return min(1, Double(progress.earnedPoints) / Double(progress.targetPoints))
    }

    var body: some View {
        THCard(palette: palette) {
            HStack(alignment: .top, spacing: THSpacing.md) {
                Text(progress.icon)
                    .font(.system(size: isYoung ? 40 : 28))
                VStack(alignment: .leading, spacing: THSpacing.sm) {
                    Text(LocalizedStringKey("goal.card.title"))
                        .font(.headline)
                        .foregroundStyle(palette.text.color)
                    Text(progress.title)
                        .foregroundStyle(palette.text.color)
                    ProgressView(value: fraction)
                        .tint(palette.accent.color)
                    Text(String(
                        format: String(localized: isTeen ? "goal.card.progress.teen" : "goal.card.progress"),
                        progress.earnedPoints,
                        progress.targetPoints
                    ))
                    .font(.footnote)
                    .foregroundStyle(palette.mutedText.color)
                }
                if isYoung {
                    YoungSpeakButton(
                        text: String(
                            format: String(localized: "goal.card.speak"),
                            progress.earnedPoints,
                            progress.targetPoints
                        ),
                        palette: palette
                    )
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

@Observable
@MainActor
final class ParentFamilyGoalSettingsViewModel {
    private let apiClient: TaakHeldenAPIClient
    var title = "Samen pizza-avond"
    var icon = "🍕"
    var targetPoints = 500
    var statusMessage: String?
    var isSaving = false

    init(apiClient: TaakHeldenAPIClient) {
        self.apiClient = apiClient
    }

    func create() async {
        isSaving = true
        defer { isSaving = false }
        do {
            _ = try await apiClient.createFamilyGoal(
                title: title,
                icon: icon,
                targetPoints: targetPoints,
                childIds: [],
                idempotencyKey: UUID().uuidString
            )
            statusMessage = String(localized: "goal.parent.created")
        } catch {
            statusMessage = String(localized: "goal.parent.error")
        }
    }
}

struct ParentFamilyGoalSettingsView: View {
    @Bindable var viewModel: ParentFamilyGoalSettingsViewModel
    let palette: THPalette

    var body: some View {
        THCard(palette: palette) {
            Text(LocalizedStringKey("goal.parent.title"))
                .font(.headline)
                .foregroundStyle(palette.text.color)
            Text(LocalizedStringKey("goal.parent.detail"))
                .font(.footnote)
                .foregroundStyle(palette.mutedText.color)
            TextField(String(localized: "goal.parent.name"), text: $viewModel.title)
            TextField(String(localized: "goal.parent.icon"), text: $viewModel.icon)
            Stepper(
                String(format: String(localized: "goal.parent.target"), viewModel.targetPoints),
                value: $viewModel.targetPoints,
                in: 50...10000,
                step: 50
            )
            Button(String(localized: "goal.parent.create")) {
                Task { await viewModel.create() }
            }
            .buttonStyle(.borderedProminent)
            .tint(palette.accent.color)
            .disabled(viewModel.isSaving)
            if let statusMessage = viewModel.statusMessage {
                Text(statusMessage)
                    .font(.footnote)
                    .foregroundStyle(palette.mutedText.color)
            }
        }
    }
}
