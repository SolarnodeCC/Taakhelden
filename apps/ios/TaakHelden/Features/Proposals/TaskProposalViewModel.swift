import Foundation
import CryptoKit
import Observation

/// State of the teen's proposal list.
enum ProposalListState: Equatable {
    case idle
    case loading
    case loaded([TaskProposalDTO])
    case error(String)
}

/// State of an in-progress proposal submission.
enum ProposalSubmitState: Equatable {
    case idle
    case submitting
    case success(TaskProposalDTO)
    case error(String)
}

/// ViewModel for WS-PROPOSAL: teen "Vraag een taak aan" feature.
///
/// - Stubs against the `POST /tasks/proposals` + `GET /tasks/proposals` contract
///   from `docs/wispel-post-review-workstreams.md` §WS-PROPOSAL.
/// - Falls back to a stub response when the API endpoint is not yet live
///   (404 → treated as "API not ready yet"; list is empty).
/// - No points are awarded for proposals — they are submitted and either
///   approved (creating a real task) or declined by a parent.
@Observable
@MainActor
final class TaskProposalViewModel {
    private let apiClient: TaakHeldenAPIClient

    var listState: ProposalListState = .idle
    var submitState: ProposalSubmitState = .idle

    // Form fields
    var formTitle: String = ""
    var formCategory: String = "homework"
    var formSuggestedPoints: Int = 10
    var formNote: String = ""

    /// One-time key for the current in-progress submission attempt.
    /// Regenerated each time the user commits a new submit; reused on network retry.
    private var pendingIdempotencyKey: String = UUID().uuidString

    /// Sorted so newest proposals appear first.
    var proposals: [TaskProposalDTO] {
        if case .loaded(let items) = listState { return items }
        return []
    }

    var canSubmit: Bool {
        !formTitle.trimmingCharacters(in: .whitespaces).isEmpty
            && formSuggestedPoints > 0
            && submitState != .submitting
    }

    init(apiClient: TaakHeldenAPIClient) {
        self.apiClient = apiClient
    }

    func loadProposals() async {
        listState = .loading
        do {
            let list = try await apiClient.fetchTaskProposals()
            listState = .loaded(list)
        } catch HTTPTransportError.httpStatus(404, _) {
            // API not yet live — treat as empty list.
            listState = .loaded([])
        } catch {
            listState = .error(String(localized: "proposal.load.error"))
        }
    }

    func submit() async {
        let title = formTitle.trimmingCharacters(in: .whitespaces)
        guard !title.isEmpty, formSuggestedPoints > 0 else { return }
        guard submitState != .submitting else { return }

        submitState = .submitting
        // Use a stable key for this submit session — same key if the user retries after a
        // network drop, so the server deduplicates and won't create a duplicate proposal.
        let key = pendingIdempotencyKey

        do {
            let proposal = try await apiClient.createTaskProposal(
                title: title,
                category: formCategory,
                suggestedPoints: formSuggestedPoints,
                note: formNote.isEmpty ? nil : formNote,
                idempotencyKey: key
            )
            submitState = .success(proposal)
            resetForm()
            await loadProposals()
        } catch HTTPTransportError.httpStatus(404, _) {
            // API not yet live — synthesise a stub result so the teen sees a confirmation.
            let stub = TaskProposalDTO(
                id: UUID().uuidString,
                childId: apiClient.authStore.childSession?.childID ?? "",
                title: title,
                category: formCategory,
                icon: "star",
                suggestedPoints: formSuggestedPoints,
                note: formNote.isEmpty ? nil : formNote,
                status: .pending,
                createdTaskId: nil
            )
            submitState = .success(stub)
            resetForm()
        } catch {
            submitState = .error(String(localized: "proposal.submit.error"))
        }
    }

    func clearSubmitState() {
        submitState = .idle
    }

    private func resetForm() {
        formTitle = ""
        formNote = ""
        formSuggestedPoints = 10
        formCategory = "homework"
        // Fresh key for the next proposal the teen submits.
        pendingIdempotencyKey = UUID().uuidString
    }
}
