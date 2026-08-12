package nl.taakhelden.family.ui.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import nl.taakhelden.core.api.ChildPairingRequest
import nl.taakhelden.core.api.ChildProfileSummary
import nl.taakhelden.core.api.FamilyCodeLookup
import nl.taakhelden.core.auth.ChildAgeBand
import nl.taakhelden.core.i18n.LocalisedFailure
import nl.taakhelden.family.R
import nl.taakhelden.family.ui.AppState
import nl.taakhelden.family.ui.components.WCard
import nl.taakhelden.family.ui.components.WPrimaryButton
import nl.taakhelden.family.ui.components.WTextButton
import nl.taakhelden.family.ui.failureOf
import nl.taakhelden.family.ui.text
import nl.taakhelden.family.ui.theme.WDimens
import nl.taakhelden.family.ui.theme.WispelTheme
import nl.taakhelden.family.ui.theme.color

private const val FAMILY_CODE_LENGTH = 6
private const val PIN_LENGTH = 4

@Composable
fun ChildPairingScreen(
    appState: AppState,
    onBack: () -> Unit,
    onPaired: () -> Unit,
) {
    val palette = WispelTheme.palette
    val scope = rememberCoroutineScope()
    val apiClient = appState.environment.apiClient

    var familyCode by remember { mutableStateOf("") }
    var resolvedFamily by remember { mutableStateOf<FamilyCodeLookup?>(null) }
    var selectedChildId by remember { mutableStateOf<String?>(null) }
    var pin by remember { mutableStateOf("") }
    var biometricsEnabled by remember { mutableStateOf(false) }
    var failure by remember { mutableStateOf<LocalisedFailure?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(palette.background.color)
            .safeDrawingPadding()
            .verticalScroll(rememberScrollState())
            .padding(WDimens.spacingXl),
        verticalArrangement = Arrangement.spacedBy(WDimens.spacingLg),
    ) {
        WTextButton(text = stringResource(R.string.common_back), onClick = onBack)

        Text(
            text = stringResource(R.string.pairing_title),
            style = MaterialTheme.typography.displaySmall,
            color = palette.text.color,
        )

        WCard {
            Text(
                text = stringResource(R.string.pairing_step_code),
                style = MaterialTheme.typography.titleMedium,
                color = palette.text.color,
            )
            OutlinedTextField(
                value = familyCode,
                onValueChange = { value ->
                    familyCode = value.filter(Char::isDigit).take(FAMILY_CODE_LENGTH)
                },
                placeholder = { Text(stringResource(R.string.pairing_code_placeholder)) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            WPrimaryButton(
                text = stringResource(R.string.pairing_load_profiles),
                onClick = {
                    scope.launch {
                        runCatching { apiClient.resolveFamilyCode(familyCode) }
                            .onSuccess {
                                resolvedFamily = it
                                failure = null
                            }
                            .onFailure { failure = failureOf(it) }
                    }
                },
                enabled = familyCode.length == FAMILY_CODE_LENGTH,
            )
        }

        resolvedFamily?.let { family ->
            WCard {
                Text(
                    text = stringResource(R.string.pairing_step_profile, family.familyName),
                    style = MaterialTheme.typography.titleMedium,
                    color = palette.text.color,
                )
                family.children.forEach { child ->
                    ChildProfileRow(
                        child = child,
                        isSelected = selectedChildId == child.id,
                        onSelect = { selectedChildId = child.id },
                    )
                }
            }
        }

        WCard {
            Text(
                text = stringResource(R.string.pairing_step_pin),
                style = MaterialTheme.typography.titleMedium,
                color = palette.text.color,
            )
            OutlinedTextField(
                value = pin,
                onValueChange = { value -> pin = value.filter(Char::isDigit).take(PIN_LENGTH) },
                placeholder = { Text(stringResource(R.string.pairing_pin_placeholder)) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(R.string.pairing_biometrics_toggle),
                    style = MaterialTheme.typography.bodyLarge,
                    color = palette.text.color,
                )
                Switch(checked = biometricsEnabled, onCheckedChange = { biometricsEnabled = it })
            }
            Text(
                text = stringResource(R.string.pairing_pin_note),
                style = MaterialTheme.typography.bodyMedium,
                color = palette.mutedText.color,
            )
        }

        failure?.let {
            Text(
                text = it.text(),
                style = MaterialTheme.typography.bodyMedium,
                color = palette.accent.color,
            )
        }

        WPrimaryButton(
            text = stringResource(R.string.pairing_submit),
            onClick = {
                val childId = selectedChildId ?: return@WPrimaryButton
                val ageBand = resolvedFamily?.children
                    ?.firstOrNull { it.id == childId }
                    ?.ageBand
                    ?: ChildAgeBand.MID

                scope.launch {
                    runCatching {
                        apiClient.pairChild(
                            ChildPairingRequest(
                                familyCode = familyCode,
                                childId = childId,
                                pin = pin,
                                ageBand = ageBand,
                            ),
                        )
                    }.onSuccess { session ->
                        appState.authStore.storeChildSession(
                            session = session,
                            biometricsEnabled = biometricsEnabled,
                            pin = pin,
                        )
                        failure = null
                        onPaired()
                    }.onFailure { failure = failureOf(it) }
                }
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = selectedChildId != null && pin.length == PIN_LENGTH,
        )
    }
}

@Composable
private fun ChildProfileRow(
    child: ChildProfileSummary,
    isSelected: Boolean,
    onSelect: () -> Unit,
) {
    val palette = WispelTheme.palette
    val background = if (isSelected) palette.accentSoft.color else palette.background.color

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(background, RoundedCornerShape(WDimens.radiusLarge))
            .clickable(onClick = onSelect)
            .padding(WDimens.spacingMd),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(WDimens.spacingMd),
    ) {
        Text(
            text = child.avatar,
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.clearAndSetSemantics { },
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = child.displayName,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.SemiBold,
                color = palette.text.color,
            )
            Text(
                text = stringResource(
                    if (child.ageBand == ChildAgeBand.TEEN) {
                        R.string.pairing_mode_teen
                    } else {
                        R.string.pairing_mode_kid
                    },
                ),
                style = MaterialTheme.typography.bodyMedium,
                color = palette.mutedText.color,
            )
        }
        if (isSelected) {
            Icon(
                imageVector = Icons.Filled.CheckCircle,
                contentDescription = null,
                tint = palette.secondary.color,
                modifier = Modifier.padding(end = 0.dp),
            )
        }
    }
}
