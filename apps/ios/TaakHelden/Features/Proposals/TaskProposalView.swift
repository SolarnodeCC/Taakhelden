import SwiftUI

/// The available task categories a teen can pick for a proposal.
private enum ProposalCategory: String, CaseIterable, Identifiable {
    case homework, household, selfcare, custom

    var id: String { rawValue }

    var localizedLabel: String {
        switch self {
        case .homework:  return String(localized: "proposal.category.homework")
        case .household: return String(localized: "proposal.category.household")
        case .selfcare:  return String(localized: "proposal.category.selfcare")
        case .custom:    return String(localized: "proposal.category.custom")
        }
    }

    var systemImage: String {
        switch self {
        case .homework:  return "book.fill"
        case .household: return "house.fill"
        case .selfcare:  return "heart.fill"
        case .custom:    return "star.fill"
        }
    }
}

/// Teen-facing view for WS-PROPOSAL.
///
/// Shown only when `isTeen` is true — accessed from a sheet button on Mijn Dag.
/// Contains:
///   1. A form to create a new "Taakvraag" (task proposal).
///   2. A list of the teen's own proposals with their status.
///
/// No points are awarded for proposals. The submission uses a stable
/// Idempotency-Key so retries never duplicate a proposal.
struct TaskProposalView: View {
    let palette: THPalette
    @Bindable var viewModel: TaskProposalViewModel

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: THSpacing.xl) {
                    formSection
                    Divider().padding(.vertical, THSpacing.xs)
                    listSection
                }
                .padding(THSpacing.xl)
            }
            .background(palette.background.color.ignoresSafeArea())
            .navigationTitle(String(localized: "proposal.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(String(localized: "proposal.close")) { dismiss() }
                }
            }
            .task { await viewModel.loadProposals() }
        }
        .overlay {
            if case .success = viewModel.submitState {
                successToast
            }
        }
    }

    // MARK: - Form

    @ViewBuilder
    private var formSection: some View {
        VStack(alignment: .leading, spacing: THSpacing.md) {
            Text(LocalizedStringKey("proposal.form.title"))
                .font(.headline)
                .foregroundStyle(palette.text.color)

            Text(LocalizedStringKey("proposal.form.detail"))
                .font(.subheadline)
                .foregroundStyle(palette.mutedText.color)

            // Task title
            VStack(alignment: .leading, spacing: THSpacing.xs) {
                Text(LocalizedStringKey("proposal.field.title"))
                    .font(.subheadline)
                    .foregroundStyle(palette.mutedText.color)
                TextField(String(localized: "proposal.field.title.placeholder"), text: $viewModel.formTitle)
                    .textFieldStyle(.roundedBorder)
                    .submitLabel(.next)
                    .accessibilityLabel(Text("proposal.field.title"))
            }

            // Category picker
            VStack(alignment: .leading, spacing: THSpacing.xs) {
                Text(LocalizedStringKey("proposal.field.category"))
                    .font(.subheadline)
                    .foregroundStyle(palette.mutedText.color)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: THSpacing.sm) {
                        ForEach(ProposalCategory.allCases) { cat in
                            Button {
                                viewModel.formCategory = cat.rawValue
                            } label: {
                                Label(cat.localizedLabel, systemImage: cat.systemImage)
                                    .font(.subheadline)
                                    .frame(minHeight: 40)
                                    .padding(.horizontal, THSpacing.sm)
                            }
                            .buttonStyle(.bordered)
                            .tint(viewModel.formCategory == cat.rawValue ? palette.accent.color : nil)
                            .accessibilityAddTraits(viewModel.formCategory == cat.rawValue ? .isSelected : [])
                        }
                    }
                }
            }

            // Suggested points stepper
            VStack(alignment: .leading, spacing: THSpacing.xs) {
                Text(String(format: String(localized: "proposal.field.points.label"), viewModel.formSuggestedPoints))
                    .font(.subheadline)
                    .foregroundStyle(palette.mutedText.color)
                Stepper(
                    String(format: String(localized: "proposal.field.points.stepper"), viewModel.formSuggestedPoints),
                    value: $viewModel.formSuggestedPoints,
                    in: 1...100,
                    step: 5
                )
                .accessibilityLabel(String(format: String(localized: "proposal.field.points.label"), viewModel.formSuggestedPoints))
            }

            // Optional note
            VStack(alignment: .leading, spacing: THSpacing.xs) {
                Text(LocalizedStringKey("proposal.field.note"))
                    .font(.subheadline)
                    .foregroundStyle(palette.mutedText.color)
                TextField(String(localized: "proposal.field.note.placeholder"), text: $viewModel.formNote, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(3, reservesSpace: true)
                    .accessibilityLabel(Text("proposal.field.note"))
            }

            // Error message
            if case .error(let msg) = viewModel.submitState {
                Text(msg)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            // Submit button
            Button {
                Task { await viewModel.submit() }
            } label: {
                Group {
                    if viewModel.submitState == .submitting {
                        ProgressView()
                    } else {
                        Text(LocalizedStringKey("proposal.submit"))
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(minHeight: 50)
            }
            .buttonStyle(.borderedProminent)
            .tint(palette.accent.color)
            .disabled(!viewModel.canSubmit)
        }
    }

    // MARK: - Proposal list

    @ViewBuilder
    private var listSection: some View {
        VStack(alignment: .leading, spacing: THSpacing.md) {
            Text(LocalizedStringKey("proposal.list.title"))
                .font(.headline)
                .foregroundStyle(palette.text.color)

            switch viewModel.listState {
            case .idle, .loading:
                ProgressView(String(localized: "proposal.list.loading"))
                    .frame(maxWidth: .infinity, alignment: .center)

            case .loaded(let items) where items.isEmpty:
                Text(LocalizedStringKey("proposal.list.empty"))
                    .foregroundStyle(palette.mutedText.color)

            case .loaded(let items):
                ForEach(items) { proposal in
                    proposalRow(proposal)
                }

            case .error(let msg):
                Text(msg)
                    .foregroundStyle(palette.mutedText.color)
            }
        }
    }

    @ViewBuilder
    private func proposalRow(_ proposal: TaskProposalDTO) -> some View {
        THCard(palette: palette) {
            HStack(alignment: .top, spacing: THSpacing.sm) {
                VStack(alignment: .leading, spacing: THSpacing.xs) {
                    Text(proposal.title)
                        .font(.headline)
                        .foregroundStyle(palette.text.color)
                    Text(String(format: String(localized: "proposal.suggested.points"), proposal.suggestedPoints))
                        .font(.subheadline)
                        .foregroundStyle(palette.mutedText.color)
                    if let note = proposal.note {
                        Text(note)
                            .font(.footnote)
                            .foregroundStyle(palette.mutedText.color)
                    }
                }
                Spacer(minLength: 0)
                proposalStatusBadge(proposal.status)
            }
        }
    }

    @ViewBuilder
    private func proposalStatusBadge(_ status: ProposalStatus) -> some View {
        let (label, tint): (LocalizedStringKey, Color) = {
            switch status {
            case .pending:  return ("proposal.status.pending",  palette.accent.color.opacity(0.8))
            case .approved: return ("proposal.status.approved", .green)
            case .declined: return ("proposal.status.declined", palette.mutedText.color)
            }
        }()
        Text(label)
            .font(.caption.bold())
            .padding(.horizontal, THSpacing.sm)
            .padding(.vertical, THSpacing.xs)
            .background(tint.opacity(0.15))
            .foregroundStyle(tint)
            .clipShape(Capsule())
    }

    // MARK: - Success toast

    @ViewBuilder
    private var successToast: some View {
        VStack {
            Spacer()
            HStack(spacing: THSpacing.sm) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(palette.accent.color)
                Text(LocalizedStringKey("proposal.submit.success"))
                    .font(.subheadline.bold())
                    .foregroundStyle(palette.text.color)
            }
            .padding(THSpacing.lg)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
            .padding(.bottom, THSpacing.xl)
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
                viewModel.clearSubmitState()
            }
        }
        .animation(.spring(response: 0.35), value: viewModel.submitState)
    }
}

/// Entrypoint button shown on teen Mijn Dag to open the proposal sheet.
struct ProposalSheetButton: View {
    let palette: THPalette
    @State private var showSheet = false
    let viewModel: TaskProposalViewModel

    var body: some View {
        Button {
            showSheet = true
        } label: {
            Label(String(localized: "proposal.button"), systemImage: "plus.circle.fill")
                .frame(maxWidth: .infinity, minHeight: 44)
        }
        .buttonStyle(.bordered)
        .tint(palette.accent.color)
        .sheet(isPresented: $showSheet) {
            TaskProposalView(palette: palette, viewModel: viewModel)
        }
    }
}
