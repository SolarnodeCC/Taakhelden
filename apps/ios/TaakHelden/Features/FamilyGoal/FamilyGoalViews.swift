import Foundation
import SwiftUI

enum FamilyGoalLoadState: Equatable {
    case idle
    case loading
    case ready(FamilyGoalProgressDTO?)
    case failed
}

@Observable
@MainActor
final class FamilyGoalViewModel {
    private let apiClient: TaakHeldenAPIClient
    var loadState: FamilyGoalLoadState = .idle

    init(apiClient: TaakHeldenAPIClient) {
        self.apiClient = apiClient
    }

    var progress: FamilyGoalProgressDTO? {
        if case .ready(let progress) = loadState { return progress }
        return nil
    }

    func load() async {
        let previous = loadState
        loadState = .loading
        do {
            let response = try await apiClient.fetchActiveFamilyGoalProgress()
            loadState = .ready(response.progress)
        } catch {
            // Keep last successful progress visible when refresh fails.
            if case .ready(let progress) = previous {
                loadState = .ready(progress)
                return
            }
            loadState = .failed
        }
    }
}

struct FamilyGoalCard: View {
    let progress: FamilyGoalProgressDTO
    let palette: THPalette
    let isYoung: Bool
    let isTeen: Bool

    private var fraction: Double {
        HeroProgress.goalFraction(earned: progress.earnedPoints, target: progress.targetPoints)
    }

    var body: some View {
        THCard(palette: palette) {
            HStack(alignment: .top, spacing: THSpacing.md) {
                Text(progress.icon)
                    .font(.system(size: isYoung ? 40 : 28))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: THSpacing.sm) {
                    Text(LocalizedStringKey("goal.card.title"))
                        .font(.headline)
                        .foregroundStyle(palette.text.color)
                    Text(progress.title)
                        .foregroundStyle(palette.text.color)
                    ProgressView(value: fraction)
                        .tint(palette.accent.color)
                        .accessibilityHidden(true)
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
        .accessibilityValue(Text("\(Int(fraction * 100))%"))
    }
}

@Observable
@MainActor
final class ParentFamilyGoalSettingsViewModel {
    private let apiClient: TaakHeldenAPIClient
    private var pendingCreateKey: String?

    var title = String(localized: "goal.parent.default.title")
    var icon = "🍕"
    var targetPoints = 500
    var statusMessage: String?
    var isSaving = false

    init(apiClient: TaakHeldenAPIClient) {
        self.apiClient = apiClient
    }

    var canCreate: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !icon.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && targetPoints >= 50
            && !isSaving
    }

    func create() async {
        guard canCreate else { return }
        isSaving = true
        defer { isSaving = false }

        let key = pendingCreateKey ?? UUID().uuidString
        pendingCreateKey = key

        do {
            _ = try await apiClient.createFamilyGoal(
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                icon: icon.trimmingCharacters(in: .whitespacesAndNewlines),
                targetPoints: targetPoints,
                childIds: [], // empty = all children (server contract)
                idempotencyKey: key
            )
            pendingCreateKey = nil
            statusMessage = String(localized: "goal.parent.created")
        } catch {
            statusMessage = String(localized: "goal.parent.error")
        }
    }

    /// Test seam for idempotent create retries.
    var pendingKeyForTests: String? { pendingCreateKey }
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
            .disabled(!viewModel.canCreate)
            if let statusMessage = viewModel.statusMessage {
                Text(statusMessage)
                    .font(.footnote)
                    .foregroundStyle(palette.mutedText.color)
            }
        }
    }
}
