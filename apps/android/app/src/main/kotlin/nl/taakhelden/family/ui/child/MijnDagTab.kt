package nl.taakhelden.family.ui.child

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bedtime
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import nl.taakhelden.core.api.InstanceViewDTO
import nl.taakhelden.core.api.TodayBalanceDTO
import nl.taakhelden.core.child.ChildDayLoadState
import nl.taakhelden.core.child.ChildDayNotice
import nl.taakhelden.family.R
import nl.taakhelden.family.ui.AppState
import nl.taakhelden.family.ui.familygoal.FamilyGoalCard
import nl.taakhelden.family.ui.focus.FocusTimerSheet
import nl.taakhelden.family.ui.components.WBadge
import nl.taakhelden.family.ui.components.WCard
import nl.taakhelden.family.ui.components.WPrimaryButton
import nl.taakhelden.family.ui.components.WSecondaryButton
import nl.taakhelden.family.ui.components.YoungSpeakButton
import nl.taakhelden.family.ui.proposals.ProposalSheetButton
import nl.taakhelden.family.ui.theme.WDimens
import nl.taakhelden.family.ui.theme.WispelTheme
import nl.taakhelden.family.ui.theme.color

private data class ActiveFocusContext(val instanceId: String, val taskTitle: String)

@Composable
fun MijnDagTab(
    appState: AppState,
    viewModel: ChildViewModel,
    isTeen: Boolean,
    reduceMotion: Boolean,
) {
    val palette = WispelTheme.palette
    val isYoung = WispelTheme.isYoung
    val speechBus = appState.environment.speechBus
    val session by appState.authStore.childSessionFlow.collectAsState()

    val state by viewModel.day.state.collectAsState()
    val notice by viewModel.day.notice.collectAsState()
    val goalState by viewModel.familyGoal.loadState.collectAsState()

    var activeFocus by remember { mutableStateOf<ActiveFocusContext?>(null) }

    val avatar = session?.avatar ?: "🦊"
    val displayName = session?.displayName ?: stringResource(R.string.held_fallback_name)

    // Pull to refresh is the gesture a child reaches for first when they think a parent
    // has just approved something; the retry button below is only for the error state.
    PullToRefreshBox(
        isRefreshing = state is ChildDayLoadState.Loading,
        onRefresh = viewModel::refreshDay,
        modifier = Modifier.fillMaxSize(),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(WDimens.spacingXl),
            verticalArrangement = Arrangement.spacedBy(WDimens.spacingLg),
        ) {
            // Teens get agency: they can propose work rather than only receive it (WS-PROPOSAL).
            if (isTeen) {
                ProposalSheetButton(store = viewModel.proposals)
            }

            (goalState as? nl.taakhelden.core.child.FamilyGoalLoadState.Ready)?.progress?.let { goal ->
                FamilyGoalCard(progress = goal, isTeen = isTeen, speechBus = speechBus)
            }

            notice?.let { current ->
                Text(
                    text = stringResource(
                        when (current) {
                            ChildDayNotice.UNDO_EXPIRED -> R.string.child_task_undo_expired
                            ChildDayNotice.PHOTO_UPLOAD_FAILED -> R.string.child_photo_upload_error
                        },
                    ),
                    style = MaterialTheme.typography.bodyMedium,
                    color = palette.mutedText.color,
                )
            }

            when (val current = state) {
                is ChildDayLoadState.Loading -> Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(WDimens.spacingMd),
                ) {
                    CircularProgressIndicator(color = palette.accent.color)
                    Text(
                        text = stringResource(R.string.child_day_loading),
                        color = palette.mutedText.color,
                    )
                }

                is ChildDayLoadState.Paused -> WCard {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(WDimens.spacingSm),
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Bedtime,
                            contentDescription = null,
                            tint = palette.accent.color,
                        )
                        Text(
                            text = stringResource(R.string.child_pause_title),
                            style = MaterialTheme.typography.titleMedium,
                            color = palette.text.color,
                        )
                    }
                    val detail = current.reason ?: stringResource(R.string.child_pause_detail)
                    Text(text = detail, color = palette.mutedText.color)
                    if (isYoung) YoungSpeakButton(text = detail, speechBus = speechBus)
                }

                is ChildDayLoadState.Ready -> {
                    DayHeader(
                        balance = current.today.balance,
                        avatar = avatar,
                        displayName = displayName,
                        isTeen = isTeen,
                        speechBus = speechBus,
                    )
                    current.today.instances.forEach { instance ->
                        TaskCard(
                            instance = instance,
                            viewModel = viewModel,
                            reduceMotion = reduceMotion,
                            speechBus = speechBus,
                            onStartFocus = {
                                activeFocus = ActiveFocusContext(instance.id, instance.title)
                            },
                        )
                    }
                }

                is ChildDayLoadState.EmptyAllDone -> {
                    DayHeader(
                        balance = current.balance,
                        avatar = avatar,
                        displayName = displayName,
                        isTeen = isTeen,
                        speechBus = speechBus,
                    )
                    val headline = stringResource(
                        if (isTeen) R.string.child_all_done_teen else R.string.child_all_done,
                    )
                    WCard {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(WDimens.spacingSm),
                        ) {
                            Text(
                                text = headline,
                                style = MaterialTheme.typography.titleMedium,
                                color = palette.text.color,
                            )
                            if (isYoung) YoungSpeakButton(text = headline, speechBus = speechBus)
                        }
                        Text(
                            text = stringResource(R.string.child_all_done_detail),
                            color = palette.mutedText.color,
                        )
                    }
                }

                is ChildDayLoadState.EmptyNoTasks -> WCard {
                    val detail = stringResource(R.string.child_no_missions_detail)
                    Text(
                        text = stringResource(R.string.child_no_missions),
                        style = MaterialTheme.typography.titleMedium,
                        color = palette.text.color,
                    )
                    Text(text = detail, color = palette.mutedText.color)
                    if (isYoung) YoungSpeakButton(text = detail, speechBus = speechBus)
                }

                is ChildDayLoadState.Offline -> WCard {
                    Text(
                        text = stringResource(R.string.child_connection_safe),
                        color = palette.text.color,
                    )
                }

                is ChildDayLoadState.Error -> WCard {
                    Text(
                        text = stringResource(R.string.child_connection_safe),
                        color = palette.text.color,
                    )
                    WSecondaryButton(
                        text = stringResource(R.string.child_retry),
                        onClick = viewModel::refreshDay,
                    )
                }
            }
        }
    }

    activeFocus?.let { context ->
        FocusTimerSheet(
            taskTitle = context.taskTitle,
            timer = viewModel.focusTimer,
            onComplete = {
                activeFocus = null
                viewModel.focusTimer.stop()
                viewModel.completeTask(context.instanceId, reduceMotion)
            },
            onDismiss = {
                activeFocus = null
                viewModel.focusTimer.stop()
            },
        )
    }
}

@Composable
private fun DayHeader(
    balance: TodayBalanceDTO,
    avatar: String,
    displayName: String,
    isTeen: Boolean,
    speechBus: nl.taakhelden.family.platform.SpeechBus,
) {
    val palette = WispelTheme.palette
    val isYoung = WispelTheme.isYoung

    WCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(WDimens.spacingMd),
        ) {
            Text(
                text = avatar,
                fontSize = if (isYoung) 56.sp else 44.sp,
                modifier = Modifier.clearAndSetSemantics { },
            )

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(WDimens.spacingXs),
            ) {
                Text(
                    text = stringResource(R.string.child_day_title),
                    style = MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.Bold,
                    color = palette.text.color,
                )
                Text(
                    text = stringResource(
                        R.string.child_day_progress,
                        balance.todayCompleted,
                        balance.todayTotal,
                    ),
                    color = palette.mutedText.color,
                )
            }

            Column(
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(WDimens.spacingSm),
            ) {
                WBadge(text = stringResource(R.string.child_points_badge, balance.balance))
                WBadge(
                    text = stringResource(
                        if (isTeen) R.string.child_streak_teen else R.string.child_streak,
                        balance.streakDays,
                    ),
                )
                if (isYoung) {
                    YoungSpeakButton(
                        text = stringResource(
                            R.string.child_day_speak,
                            balance.todayCompleted,
                            balance.todayTotal,
                        ),
                        speechBus = speechBus,
                    )
                }
            }
        }

        // Also announce the avatar for a screen reader, which the decorative emoji hides.
        Text(
            text = displayName,
            style = MaterialTheme.typography.bodyMedium,
            color = palette.mutedText.color,
        )
    }
}

@Composable
private fun TaskCard(
    instance: InstanceViewDTO,
    viewModel: ChildViewModel,
    reduceMotion: Boolean,
    speechBus: nl.taakhelden.family.platform.SpeechBus,
    onStartFocus: () -> Unit,
) {
    val palette = WispelTheme.palette
    val isYoung = WispelTheme.isYoung

    val isDone = instance.status != "open" && instance.status != "open_redo"
    // Approved work is settled — offering "undo" there would suggest a child can take
    // back points a parent already granted.
    val canUndo = isDone &&
        instance.status != "approved" &&
        viewModel.day.isInUndoWindow(instance.id)

    WCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(WDimens.spacingMd),
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(WDimens.spacingSm),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(WDimens.spacingSm),
                ) {
                    Icon(
                        imageVector = Icons.Filled.AutoAwesome,
                        contentDescription = null,
                        tint = palette.accent.color,
                    )
                    Text(
                        text = instance.title,
                        style = MaterialTheme.typography.titleMedium,
                        color = palette.text.color,
                    )
                }
                Text(
                    text = stringResource(R.string.child_task_points, instance.points),
                    color = palette.mutedText.color,
                )

                when {
                    instance.photoStatus != null -> Text(
                        text = stringResource(
                            if (instance.photoStatus == "ready") {
                                R.string.child_photo_ready
                            } else {
                                R.string.child_photo_processing
                            },
                        ),
                        style = MaterialTheme.typography.bodyMedium,
                        color = palette.mutedText.color,
                    )

                    isDone && instance.photoBonusPoints > 0 && instance.photoId == null -> Text(
                        text = stringResource(
                            R.string.child_photo_bonus_hint,
                            instance.photoBonusPoints,
                        ),
                        style = MaterialTheme.typography.bodyMedium,
                        color = palette.mutedText.color,
                    )
                }
            }

            if (isYoung) {
                YoungSpeakButton(text = instance.title, speechBus = speechBus)
            }

            if (isDone) {
                Icon(
                    imageVector = Icons.Filled.CheckCircle,
                    contentDescription = stringResource(R.string.child_task_done),
                    tint = palette.accent.color,
                )
            } else {
                WPrimaryButton(
                    text = stringResource(R.string.child_task_done_button),
                    onClick = { viewModel.completeTask(instance.id, reduceMotion) },
                )
            }
        }

        // Focus timer is offered for open work on non-young profiles: a 5-year-old does
        // not need a countdown, an 8-year-old with homework does.
        if (!isDone && !isYoung) {
            WSecondaryButton(
                text = stringResource(R.string.focus_button_inline),
                onClick = onStartFocus,
            )
        }

        if (isDone && instance.photoBonusPoints > 0 && instance.photoId == null) {
            PhotoBonusPicker(
                onPhotoReady = { jpeg -> viewModel.uploadPhoto(instance.id, jpeg) },
            )
        }

        if (canUndo) {
            WSecondaryButton(
                text = stringResource(R.string.child_task_undo_button),
                onClick = { viewModel.undoTask(instance.id) },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
