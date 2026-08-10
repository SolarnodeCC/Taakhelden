package nl.taakhelden.family.ui.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.launch
import nl.taakhelden.core.gate.ChildUnlockMode
import nl.taakhelden.core.gate.ParentGatePolicy
import nl.taakhelden.family.R
import nl.taakhelden.family.platform.BiometricAuthenticator
import nl.taakhelden.family.ui.AppState
import nl.taakhelden.family.ui.components.WCard
import nl.taakhelden.family.ui.components.WPrimaryButton
import nl.taakhelden.family.ui.components.YoungSpeakButton
import nl.taakhelden.family.ui.theme.WDimens
import nl.taakhelden.family.ui.theme.WispelTheme
import nl.taakhelden.family.ui.theme.color

private const val PIN_LENGTH = 4

/**
 * The daily unlock for a child device.
 *
 * The PIN pad is always on screen for under-13 profiles (ADR-0002): biometrics may not be
 * enrolled, may belong to a sibling, or may simply fail, and a child must never be shut
 * out of their own space. Teens can go biometrics-first.
 */
@Composable
fun ChildUnlockScreen(
    appState: AppState,
    activity: FragmentActivity,
    onUnlocked: () -> Unit,
) {
    val palette = WispelTheme.palette
    val isYoung = WispelTheme.isYoung
    val scope = rememberCoroutineScope()
    val speechBus = appState.environment.speechBus
    val session by appState.authStore.childSessionFlow.collectAsState()

    val authenticator = remember(activity) { BiometricAuthenticator(activity) }
    var pin by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val unlockMode = remember(session, authenticator) {
        val current = session
        if (current == null) {
            ChildUnlockMode.PIN_ONLY
        } else {
            ParentGatePolicy.childUnlockMode(
                ageBand = current.ageBand,
                biometricsEnabled = current.biometricsEnabled &&
                    authenticator.canEvaluateBiometrics(),
            )
        }
    }

    val retryMessage = stringResource(
        if (isYoung) R.string.child_young_pin_retry else R.string.child_unlock_pin_retry,
    )
    val biometricsTitle = stringResource(R.string.child_unlock_title)
    val biometricsReason = stringResource(R.string.child_unlock_biometrics_reason)
    val pinFallbackLabel = stringResource(R.string.child_unlock_pin_alternative)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(palette.background.color)
            .safeDrawingPadding()
            .padding(WDimens.spacingXl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(WDimens.spacingXl),
    ) {
        Spacer(Modifier.weight(1f))

        session?.let { current ->
            Text(
                text = current.avatar,
                fontSize = if (isYoung) 88.sp else 72.sp,
                modifier = Modifier.clearAndSetSemantics { },
            )
            Text(
                text = if (isYoung) {
                    stringResource(R.string.child_unlock_hi_young)
                } else {
                    stringResource(R.string.child_unlock_hi, current.displayName)
                },
                style = MaterialTheme.typography.displaySmall,
                fontWeight = FontWeight.Bold,
                color = palette.text.color,
            )

            if (isYoung) {
                val intro = stringResource(
                    R.string.child_unlock_speak_intro,
                    current.displayName,
                )
                YoungSpeakButton(text = intro, speechBus = speechBus)
            }
        }

        WCard {
            Text(
                text = stringResource(
                    if (isYoung) R.string.child_young_unlock_title else R.string.child_unlock_title,
                ),
                style = MaterialTheme.typography.titleMedium,
                color = palette.text.color,
            )

            if (unlockMode != ChildUnlockMode.PIN_ONLY) {
                WPrimaryButton(
                    text = stringResource(R.string.child_unlock_biometrics),
                    onClick = {
                        scope.launch {
                            val success = runCatching {
                                authenticator.evaluateBiometrics(
                                    title = biometricsTitle,
                                    subtitle = biometricsReason,
                                    negativeButtonText = pinFallbackLabel,
                                )
                            }.getOrDefault(false)
                            if (success) {
                                errorMessage = null
                                onUnlocked()
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                )

                Text(
                    text = pinFallbackLabel,
                    style = MaterialTheme.typography.bodyMedium,
                    color = palette.mutedText.color,
                )
            }

            NumericPinPad(
                pin = pin,
                maxDigits = PIN_LENGTH,
                onPinChange = { pin = it },
                onComplete = {
                    if (appState.authStore.verifyPin(pin)) {
                        errorMessage = null
                        onUnlocked()
                    } else {
                        errorMessage = retryMessage
                        pin = ""
                    }
                },
            )
        }

        errorMessage?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.bodyLarge,
                color = palette.accent.color,
                textAlign = TextAlign.Center,
            )
        }

        Spacer(Modifier.weight(1f))
    }
}

@Composable
fun NumericPinPad(
    pin: String,
    maxDigits: Int,
    onPinChange: (String) -> Unit,
    onComplete: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val palette = WispelTheme.palette
    val deleteLabel = stringResource(R.string.common_delete_digit)

    fun tap(digit: String) {
        if (digit == BACKSPACE) {
            if (pin.isNotEmpty()) onPinChange(pin.dropLast(1))
            return
        }
        if (pin.length >= maxDigits) return
        val next = pin + digit
        onPinChange(next)
        if (next.length == maxDigits) onComplete()
    }

    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(WDimens.spacingMd),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(WDimens.spacingSm),
            modifier = Modifier.clearAndSetSemantics { },
        ) {
            repeat(maxDigits) { index ->
                val filled = index < pin.length
                Box(
                    modifier = Modifier
                        .size(14.dp)
                        .background(
                            if (filled) palette.text.color else palette.mutedText.color.copy(0.2f),
                            CircleShape,
                        ),
                )
            }
        }

        PIN_PAD_ROWS.forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(WDimens.spacingMd)) {
                row.forEach { digit ->
                    if (digit.isEmpty()) {
                        Spacer(modifier = Modifier.width(KEY_WIDTH).height(KEY_HEIGHT))
                    } else {
                        Text(
                            text = digit,
                            textAlign = TextAlign.Center,
                            style = MaterialTheme.typography.headlineSmall,
                            color = palette.text.color,
                            modifier = Modifier
                                .width(KEY_WIDTH)
                                .height(KEY_HEIGHT)
                                .background(
                                    palette.mutedText.color.copy(alpha = 0.12f),
                                    RoundedCornerShape(WDimens.radiusLarge),
                                )
                                .clickable(
                                    onClickLabel = if (digit == BACKSPACE) deleteLabel else digit,
                                    onClick = { tap(digit) },
                                )
                                .padding(vertical = WDimens.spacingMd),
                        )
                    }
                }
            }
        }
    }
}

private val PIN_PAD_ROWS = listOf(
    listOf("1", "2", "3"),
    listOf("4", "5", "6"),
    listOf("7", "8", "9"),
    listOf("", "0", BACKSPACE),
)

private const val BACKSPACE = "⌫"
private val KEY_WIDTH = 72.dp
private val KEY_HEIGHT = 56.dp
