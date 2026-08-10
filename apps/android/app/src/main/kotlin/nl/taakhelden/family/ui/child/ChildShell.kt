package nl.taakhelden.family.ui.child

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.viewmodel.compose.viewModel
import nl.taakhelden.core.auth.ChildAgeBand
import nl.taakhelden.family.R
import nl.taakhelden.family.ui.AppState
import nl.taakhelden.family.ui.ChildTab
import nl.taakhelden.family.ui.components.ConfettiOverlay
import nl.taakhelden.family.ui.components.WBadge
import nl.taakhelden.family.ui.components.WPrimaryButton
import nl.taakhelden.family.ui.components.WSecondaryButton
import nl.taakhelden.family.ui.components.rememberReduceMotion
import nl.taakhelden.family.ui.theme.WDimens
import nl.taakhelden.family.ui.theme.WispelTheme
import nl.taakhelden.family.ui.theme.color

/**
 * The child home: exactly three tabs, and no permanent parent tab (ADR-0003). Parent mode
 * is only reachable through the hidden gestures on Mijn Ster.
 */
@Composable
fun ChildShell(appState: AppState) {
    val palette = WispelTheme.palette
    val context = LocalContext.current
    val session by appState.authStore.childSessionFlow.collectAsState()
    val selectedTab by appState.selectedChildTab.collectAsState()
    val reduceMotion = rememberReduceMotion()
    val isTeen = session?.ageBand == ChildAgeBand.TEEN

    val viewModel: ChildViewModel = viewModel(
        factory = ChildViewModel.Factory(appState.environment, session?.childId),
    )

    val confettiToken by viewModel.confettiToken.collectAsState()
    val pendingMutations by viewModel.mutationQueue.pending.collectAsState()
    val isSyncing by viewModel.syncEngine.isSyncing.collectAsState()

    var showPushPrimer by remember { mutableStateOf(false) }

    val notificationPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { /* Push is optional: a decline changes nothing else in the app. */ }

    LaunchedEffect(Unit) {
        viewModel.loadAll()
        // Guideline: explain before the system dialog. Below API 33 there is no runtime
        // notification permission, so there is nothing to prime.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = androidx.core.content.ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS,
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
            showPushPrimer = !granted
        }
    }

    Scaffold(
        containerColor = palette.background.color,
        bottomBar = {
            NavigationBar(containerColor = palette.surface.color) {
                ChildTabItem(
                    tab = ChildTab.MIJN_DAG,
                    selected = selectedTab == ChildTab.MIJN_DAG,
                    labelRes = if (WispelTheme.isYoung) {
                        R.string.child_tab_day_young
                    } else {
                        R.string.child_tab_day
                    },
                    icon = Icons.Filled.Checklist,
                    onSelect = appState::selectChildTab,
                )
                ChildTabItem(
                    tab = ChildTab.WINKEL,
                    selected = selectedTab == ChildTab.WINKEL,
                    labelRes = if (WispelTheme.isYoung) {
                        R.string.child_tab_shop_young
                    } else {
                        R.string.child_tab_shop
                    },
                    icon = Icons.Filled.CardGiftcard,
                    onSelect = appState::selectChildTab,
                )
                ChildTabItem(
                    tab = ChildTab.MIJN_STER,
                    selected = selectedTab == ChildTab.MIJN_STER,
                    labelRes = if (WispelTheme.isYoung) {
                        R.string.child_tab_hero_young
                    } else {
                        R.string.child_tab_hero
                    },
                    icon = Icons.Filled.AutoAwesome,
                    onSelect = appState::selectChildTab,
                )
            }
        },
    ) { innerPadding ->
        Box(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            when (selectedTab) {
                ChildTab.MIJN_DAG -> MijnDagTab(
                    appState = appState,
                    viewModel = viewModel,
                    isTeen = isTeen,
                    reduceMotion = reduceMotion,
                )

                ChildTab.WINKEL -> WinkelTab(
                    appState = appState,
                    viewModel = viewModel,
                    isTeen = isTeen,
                    reduceMotion = reduceMotion,
                )

                ChildTab.MIJN_STER -> MijnSterTab(
                    appState = appState,
                    viewModel = viewModel,
                )
            }

            // Offline reassurance: the child's work is never lost, and saying so beats
            // an error banner they cannot act on.
            if (pendingMutations.isNotEmpty() || isSyncing) {
                WBadge(
                    text = stringResource(R.string.child_offline_safe),
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = WDimens.spacingSm),
                )
            }

            ConfettiOverlay(token = confettiToken, reduceMotion = reduceMotion)
        }
    }

    if (showPushPrimer) {
        PushOptInPrimer(
            onAccept = {
                showPushPrimer = false
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            },
            onDecline = { showPushPrimer = false },
        )
    }
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.ChildTabItem(
    tab: ChildTab,
    selected: Boolean,
    labelRes: Int,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onSelect: (ChildTab) -> Unit,
) {
    val palette = WispelTheme.palette
    NavigationBarItem(
        selected = selected,
        onClick = { onSelect(tab) },
        icon = { Icon(imageVector = icon, contentDescription = null) },
        label = { Text(stringResource(labelRes)) },
        colors = NavigationBarItemDefaults.colors(
            selectedIconColor = palette.onAccent.color,
            selectedTextColor = palette.text.color,
            indicatorColor = palette.accentSoft.color,
            unselectedIconColor = palette.mutedText.color,
            unselectedTextColor = palette.mutedText.color,
        ),
    )
}

/**
 * Pre-permission primer.
 *
 * Asking the system dialog cold burns the one chance to get notifications enabled; a
 * child (or their parent) deserves to know what they are agreeing to first.
 */
@Composable
private fun PushOptInPrimer(
    onAccept: () -> Unit,
    onDecline: () -> Unit,
) {
    val palette = WispelTheme.palette
    val sheetState = rememberModalBottomSheetState()

    ModalBottomSheet(
        onDismissRequest = onDecline,
        sheetState = sheetState,
        containerColor = palette.background.color,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(WDimens.spacingXl),
            verticalArrangement = Arrangement.spacedBy(WDimens.spacingLg),
        ) {
            Text(
                text = stringResource(R.string.child_push_primer_title),
                style = MaterialTheme.typography.headlineSmall,
                color = palette.text.color,
            )
            Text(
                text = stringResource(R.string.child_push_primer_body),
                style = MaterialTheme.typography.bodyLarge,
                color = palette.mutedText.color,
            )
            WPrimaryButton(
                text = stringResource(R.string.child_push_primer_accept),
                onClick = onAccept,
                modifier = Modifier.fillMaxWidth(),
            )
            WSecondaryButton(
                text = stringResource(R.string.child_push_primer_decline),
                onClick = onDecline,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
