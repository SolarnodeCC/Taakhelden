package nl.taakhelden.family.ui.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import kotlinx.coroutines.launch
import nl.taakhelden.core.designsystem.AvatarCatalog
import nl.taakhelden.core.i18n.LocalisedFailure
import nl.taakhelden.core.i18n.UserMessage
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

private const val PIN_LENGTH = 4
private const val BIRTH_YEAR_LENGTH = 4

private enum class OnboardingStep { SIGN_IN, CREATE_CHILD, SHOW_FAMILY_CODE }

/**
 * Parent onboarding: sign in with Apple, create the first child, hand over the family
 * code. The family code is the only thing a child device needs, so it gets a screen of
 * its own rather than being buried in a confirmation toast.
 */
@Composable
fun ParentOnboardingScreen(
    appState: AppState,
    onBack: () -> Unit,
    onGoToPairing: () -> Unit,
) {
    val palette = WispelTheme.palette
    val scope = rememberCoroutineScope()
    val apiClient = appState.environment.apiClient

    var step by remember {
        mutableStateOf(
            if (appState.authStore.parentSession != null) {
                OnboardingStep.CREATE_CHILD
            } else {
                OnboardingStep.SIGN_IN
            },
        )
    }
    var familyName by remember { mutableStateOf("") }
    var childName by remember { mutableStateOf("") }
    var birthYear by remember { mutableStateOf("2018") }
    var pin by remember { mutableStateOf("") }
    var selectedAvatar by remember { mutableStateOf(AvatarCatalog.selectableEmojis.first()) }
    var inviteCode by remember { mutableStateOf<String?>(null) }
    var createdChildName by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(false) }
    var failure by remember { mutableStateOf<LocalisedFailure?>(null) }

    val defaultFamilyName = stringResource(R.string.onboarding_default_family_name)
    val defaultParentName = stringResource(R.string.onboarding_default_parent_name)

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
            text = stringResource(R.string.onboarding_title),
            style = MaterialTheme.typography.displaySmall,
            color = palette.text.color,
        )

        when (step) {
            OnboardingStep.SIGN_IN -> WCard {
                Text(
                    text = stringResource(R.string.onboarding_signin_detail),
                    style = MaterialTheme.typography.bodyLarge,
                    color = palette.mutedText.color,
                )
                OutlinedTextField(
                    value = familyName,
                    onValueChange = { familyName = it },
                    label = { Text(stringResource(R.string.onboarding_family_name)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                AppleSignInButton(
                    flow = appState.environment.appleSignIn,
                    onIdentity = { identity ->
                        scope.launch {
                            isLoading = true
                            val resolvedFamilyName = familyName.ifBlank {
                                identity.familyName ?: defaultFamilyName
                            }
                            runCatching {
                                apiClient.signInWithApple(
                                    identityToken = identity.identityToken,
                                    familyName = resolvedFamilyName,
                                    displayName = identity.displayName ?: defaultParentName,
                                )
                            }.onSuccess { session ->
                                appState.authStore.storeParentSession(session)
                                if (familyName.isBlank()) familyName = resolvedFamilyName
                                step = OnboardingStep.CREATE_CHILD
                                failure = null
                            }.onFailure { failure = failureOf(it) }
                            isLoading = false
                        }
                    },
                )
            }

            OnboardingStep.CREATE_CHILD -> WCard {
                Text(
                    text = stringResource(R.string.onboarding_child_title),
                    style = MaterialTheme.typography.titleMedium,
                    color = palette.text.color,
                )
                OutlinedTextField(
                    value = childName,
                    onValueChange = { childName = it },
                    label = { Text(stringResource(R.string.onboarding_child_name)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = birthYear,
                    onValueChange = { value ->
                        birthYear = value.filter(Char::isDigit).take(BIRTH_YEAR_LENGTH)
                    },
                    label = { Text(stringResource(R.string.onboarding_child_birth_year)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )

                Text(
                    text = stringResource(R.string.onboarding_child_avatar),
                    style = MaterialTheme.typography.titleMedium,
                    color = palette.text.color,
                )
                AvatarPicker(
                    selected = selectedAvatar,
                    onSelect = { selectedAvatar = it },
                )

                OutlinedTextField(
                    value = pin,
                    onValueChange = { value -> pin = value.filter(Char::isDigit).take(PIN_LENGTH) },
                    label = { Text(stringResource(R.string.onboarding_child_pin)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )

                WPrimaryButton(
                    text = stringResource(R.string.onboarding_child_submit),
                    onClick = {
                        val year = birthYear.toIntOrNull()
                        if (pin.length != PIN_LENGTH || year == null || childName.isBlank()) {
                            failure = LocalisedFailure(UserMessage.INVALID_PIN)
                            return@WPrimaryButton
                        }
                        scope.launch {
                            isLoading = true
                            runCatching {
                                val member = apiClient.createChild(
                                    displayName = childName,
                                    birthYear = year,
                                    avatarId = AvatarCatalog.idForEmoji(selectedAvatar),
                                    pin = pin,
                                )
                                createdChildName = member.displayName
                                apiClient.fetchParentFamily()
                            }.onSuccess { family ->
                                inviteCode = family.inviteCode
                                step = OnboardingStep.SHOW_FAMILY_CODE
                                failure = null
                            }.onFailure { failure = failureOf(it) }
                            isLoading = false
                        }
                    },
                    enabled = pin.length == PIN_LENGTH && childName.isNotBlank() && !isLoading,
                )
            }

            OnboardingStep.SHOW_FAMILY_CODE -> {
                val code = inviteCode
                val childFallback = stringResource(R.string.onboarding_code_child_fallback)
                WCard {
                    Text(
                        text = stringResource(R.string.onboarding_code_title),
                        style = MaterialTheme.typography.titleMedium,
                        color = palette.text.color,
                    )
                    if (code != null) {
                        val spoken = stringResource(R.string.onboarding_code_accessibility, code)
                        Text(
                            text = code,
                            style = MaterialTheme.typography.displaySmall,
                            fontWeight = FontWeight.Bold,
                            color = palette.text.color,
                            modifier = Modifier.semantics { contentDescription = spoken },
                        )
                    }
                    Text(
                        text = stringResource(
                            R.string.onboarding_code_detail,
                            createdChildName ?: childFallback,
                        ),
                        style = MaterialTheme.typography.bodyLarge,
                        color = palette.mutedText.color,
                    )
                }
                WPrimaryButton(
                    text = stringResource(R.string.onboarding_code_next),
                    onClick = onGoToPairing,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        failure?.let {
            Text(
                text = it.text(),
                style = MaterialTheme.typography.bodyMedium,
                color = palette.accent.color,
            )
        }

        if (isLoading) {
            CircularProgressIndicator(color = palette.accent.color)
        }
    }
}

/**
 * Fixed rows of three rather than a lazy grid: the whole screen already scrolls, and a
 * lazy grid nested in a scrolling column is a measurement crash waiting to happen. There
 * are six avatars, so nothing is gained by making the list lazy.
 */
@Composable
private fun AvatarPicker(
    selected: String,
    onSelect: (String) -> Unit,
) {
    val palette = WispelTheme.palette
    Column(verticalArrangement = Arrangement.spacedBy(WDimens.spacingMd)) {
        AvatarCatalog.selectableEmojis.chunked(AVATARS_PER_ROW).forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(WDimens.spacingMd),
            ) {
                row.forEach { emoji ->
                    val isSelected = emoji == selected
                    val background = if (isSelected) {
                        palette.accentSoft.color
                    } else {
                        palette.background.color
                    }
                    Text(
                        text = emoji,
                        textAlign = TextAlign.Center,
                        style = MaterialTheme.typography.displaySmall,
                        modifier = Modifier
                            .weight(1f)
                            .background(background, RoundedCornerShape(WDimens.radiusLarge))
                            .selectable(
                                selected = isSelected,
                                role = Role.RadioButton,
                                onClick = { onSelect(emoji) },
                            )
                            .padding(vertical = WDimens.spacingMd),
                    )
                }
                // Keeps the last row aligned with the ones above it when it is short.
                repeat(AVATARS_PER_ROW - row.size) {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

private const val AVATARS_PER_ROW = 3
