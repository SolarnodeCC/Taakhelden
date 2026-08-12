package nl.taakhelden.core.child

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import nl.taakhelden.core.api.HttpTransportException
import nl.taakhelden.core.api.ProposalStatus
import nl.taakhelden.core.api.TaakHeldenApiClient
import nl.taakhelden.core.api.TaskProposalDTO
import java.util.UUID

public sealed interface ProposalListState {
    public data object Idle : ProposalListState
    public data object Loading : ProposalListState
    public data class Loaded(val items: List<TaskProposalDTO>) : ProposalListState
    public data object Error : ProposalListState
}

public sealed interface ProposalSubmitState {
    public data object Idle : ProposalSubmitState
    public data object Submitting : ProposalSubmitState
    public data class Success(val proposal: TaskProposalDTO) : ProposalSubmitState
    public data object Error : ProposalSubmitState
}

public data class ProposalFormState(
    val title: String = "",
    val category: String = DEFAULT_CATEGORY,
    val suggestedPoints: Int = DEFAULT_POINTS,
    val note: String = "",
) {
    public companion object {
        public const val DEFAULT_CATEGORY: String = "homework"
        public const val DEFAULT_POINTS: Int = 10
        public val CATEGORIES: List<String> =
            listOf("homework", "household", "selfcare", "custom")
    }
}

/**
 * WS-PROPOSAL: the teen "Vraag een taak aan" flow.
 *
 * No points are awarded for a proposal — a parent approves it into a real task or
 * declines it. When the endpoint is not live yet the API answers 404; rather than showing
 * a teen an error for a feature that is simply not switched on, we treat that as an empty
 * list and echo their submission back optimistically.
 */
public class TaskProposalStore(
    private val apiClient: TaakHeldenApiClient,
) {
    private val _listState = MutableStateFlow<ProposalListState>(ProposalListState.Idle)
    public val listState: StateFlow<ProposalListState> = _listState.asStateFlow()

    private val _submitState = MutableStateFlow<ProposalSubmitState>(ProposalSubmitState.Idle)
    public val submitState: StateFlow<ProposalSubmitState> = _submitState.asStateFlow()

    private val _form = MutableStateFlow(ProposalFormState())
    public val form: StateFlow<ProposalFormState> = _form.asStateFlow()

    /**
     * One key per in-progress submission attempt. Regenerated after a successful submit,
     * reused on a network retry so the server deduplicates instead of creating twins.
     */
    private var pendingIdempotencyKey: String = UUID.randomUUID().toString()

    public val proposals: List<TaskProposalDTO>
        get() = (_listState.value as? ProposalListState.Loaded)?.items ?: emptyList()

    public val canSubmit: Boolean
        get() = _form.value.title.isNotBlank() &&
            _form.value.suggestedPoints > 0 &&
            _submitState.value !is ProposalSubmitState.Submitting

    public fun updateTitle(title: String) {
        _form.value = _form.value.copy(title = title)
    }

    public fun updateCategory(category: String) {
        _form.value = _form.value.copy(category = category)
    }

    public fun updateSuggestedPoints(points: Int) {
        _form.value = _form.value.copy(suggestedPoints = points.coerceIn(1, 100))
    }

    public fun updateNote(note: String) {
        _form.value = _form.value.copy(note = note)
    }

    public fun clearSubmitState() {
        _submitState.value = ProposalSubmitState.Idle
    }

    public suspend fun loadProposals() {
        _listState.value = ProposalListState.Loading
        try {
            _listState.value = ProposalListState.Loaded(apiClient.fetchTaskProposals())
        } catch (error: HttpTransportException.HttpStatus) {
            _listState.value = if (error.statusCode == 404) {
                ProposalListState.Loaded(emptyList())
            } else {
                ProposalListState.Error
            }
        } catch (_: Exception) {
            _listState.value = ProposalListState.Error
        }
    }

    public suspend fun submit() {
        val form = _form.value
        val title = form.title.trim()
        if (title.isEmpty() || form.suggestedPoints <= 0) return
        if (_submitState.value is ProposalSubmitState.Submitting) return

        _submitState.value = ProposalSubmitState.Submitting
        val key = pendingIdempotencyKey

        try {
            val proposal = apiClient.createTaskProposal(
                title = title,
                category = form.category,
                suggestedPoints = form.suggestedPoints,
                note = form.note.ifEmpty { null },
                idempotencyKey = key,
            )
            _submitState.value = ProposalSubmitState.Success(proposal)
            resetForm()
            loadProposals()
        } catch (error: HttpTransportException.HttpStatus) {
            if (error.statusCode == 404) {
                _submitState.value = ProposalSubmitState.Success(
                    TaskProposalDTO(
                        id = UUID.randomUUID().toString(),
                        childId = apiClient.authStore.childSession?.childId.orEmpty(),
                        title = title,
                        category = form.category,
                        icon = "star",
                        suggestedPoints = form.suggestedPoints,
                        note = form.note.ifEmpty { null },
                        status = ProposalStatus.PENDING,
                        createdTaskId = null,
                    ),
                )
                resetForm()
            } else {
                _submitState.value = ProposalSubmitState.Error
            }
        } catch (_: Exception) {
            _submitState.value = ProposalSubmitState.Error
        }
    }

    private fun resetForm() {
        _form.value = ProposalFormState()
        // Fresh key for the next proposal the teen submits.
        pendingIdempotencyKey = UUID.randomUUID().toString()
    }
}
