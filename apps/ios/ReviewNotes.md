# App Review notes — Wispel (familie-app)

**Wispel** wordt in de App Store gepositioneerd als **familie-app**. De listing
blijft family-first en niet child-primary (niet Kids Category). Display name: Wispel.

## Staging demo credentials

Vul deze waarden in na het aanmaken van het review-gezin op **staging** (of gebruik
de onderstaande voorbeeldwaarden als het gezin al is ingericht):

| Veld | Waarde |
|------|--------|
| Demo gezinscode | `482916` — vervang na `POST /members/children` + `GET /families/me` |
| Demo kind (roepnaam) | `DemoKind` |
| Demo kind-PIN | `4242` |

**Aanmaken op staging (één device):**

1. Kies **Ik ben een ouder** → Sign in with Apple (sandbox-account).
2. Maak kind **DemoKind** aan met PIN **4242**.
3. Noteer de getoonde gezinscode en werk de tabel hierboven bij.

## One-device review flow (zonder tweede telefoon)

1. Open de app en kies **Ik ben een ouder** om de ouder-onboarding te zien (SIWA).
2. Keer terug naar het startscherm en kies **Ik heb al een gezinscode**.
3. Vul gezinscode **482916** (of actuele staging-code) en kind-PIN **4242** in.
4. Kies profiel **DemoKind** en voltooi koppeling.
5. In kindmodus: taak afvinken op **Mijn Dag** (haptic + confetti of reduce-motion glow).
6. Open de ouderpoort via **Mijn Ster**: houd ~1,5 s vast op het scherm (hinttekst
   onderaan), of tik vijf keer. Alternatief: VoiceOver → “Open ouderpoort” op de avatar.
7. Bevestig dat Face ID / toestelcode **eerst** vereist is; pas daarna verschijnen
   ouderinstellingen. Kind-PIN opent die poort niet.
8. Account verwijderen: Instellingen → account wissen (SIWA-herbevestiging).

## Build / environment (voor reviewers & CI)

- **Release** builds gebruiken `https://taakhelden-api.oostelaar.workers.dev/v1`
  (Info.plist `TAAKHELDEN_API_BASE_URL` — Worker rename follows WS-INFRA). Debug gebruikt localhost voor lokale API.
- Release entitlements: `aps-environment = production`.
- Override voor een eigen staging: scheme env `TAAKHELDEN_API_BASE_URL`.

## Compliance notes

- Voor kinderen onder 13 blijft de **pincode altijd zichtbaar** naast Face ID.
- Foto-bonus gebruikt alleen camera of PHPicker (geen volledige fotobibliotheek).
- Lockscreen pushtekst blijft generiek; geen taaknaam, kindnaam of fotodetails.
- Push is optioneel: eerst een in-app uitleg, daarna pas de systeemdialog.
  De app werkt volledig zonder meldingen.
- Geluid bij taak klaar is uit te zetten via de ouderpoort (toggle).
- iPad: multitasking ondersteund (geen `UIRequiresFullScreen`) — parental gate
  blijft via LocalAuthentication vóór ouderinstellingen.
- Privacy Nutrition Labels (App Store Connect): Photos or Videos (taakfoto’s),
  Contact Info (ouder e-mail via SIWA), Identifiers (device/push token). Geen
  tracking / geen third-party analytics.
- Camera / Face ID usage strings: productnaam **Wispel**.

## WS-TRUST-IOS — deferred items (follow-up PR)

### Shared-device multi-child profile picker (skipped — larger scope)

The data model already supports multiple children per device: `devices` PK is
`(apns_token, user_id)` and child sessions are per child (migration 0006).
The gap is UI: a profile-picker screen on the shared iPad that switches the
active child session without re-onboarding.

Scope: session-management screen + picker view, no schema change, no API change.
Track as a follow-up to `cursor/post-review-trust-b5-f6b0` once the four
security/a11y items in this PR are validated.

Reference: `docs/wispel-post-review-workstreams.md` §WS-TRUST-IOS, acceptance
criterion 4 (multi-child per device).

---

## App Store readiness checklist — Gate G5 (WS-IOS-STORE)

Gate G5 unblocks `WS-ANDROID`. All items below must be true before submitting.
Reference: `docs/wispel-post-review-workstreams.md` §Gate G5.

### G5 criteria

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| G5-1 | Wispel iPhone app **accepted** by Apple and publicly live in NL App Store | ⬜ Pending | App Store listing URL: — |
| G5-2 | Sign in with Apple (SIWA) + account-delete flow tested end-to-end on production build | ⬜ Pending | Test on real device with App Store build |
| G5-3 | Privacy nutrition labels submitted **and** approved in App Store Connect | ⬜ Pending | Photos/Videos · Contact Info · Identifiers (see Compliance notes above) |
| G5-4 | ReviewNotes contain **real** staging credentials (parent + child accounts, not stub bypass) | ⬜ Pending | Update "Staging demo credentials" table after prod review gezin is set up |
| G5-5 | Zero P0 trust blockers open at submission | ⬜ Pending | All WS-TRUST-IOS items from `docs/wispel-post-review-workstreams.md` resolved |

### Pre-submission checklist (per build)

#### Trust & security (WS-TRUST-IOS — must be resolved)
- [ ] No code path writes raw child PIN to Keychain or `UserDefaults`; only the device refresh token is stored (`PINHasher.makeStored` + `verify` pattern; unit test in `TaakHeldenTests`)
- [ ] Undo ("Oeps, toch niet") affordance works within 5-min server window; `UNDO_WINDOW_EXPIRED` shows friendly copy after expiry
- [ ] `CelebrationService.celebrateTaskCompleted(reduceMotion:)` respects `accessibilityReduceMotion` — no confetti fired when on, haptic + chime still play
- [ ] Logout calls `DELETE /devices/:token` for the departing profile's APNs row (`deregisterDevice`)
- [ ] Multi-child per shared iPad: each child can log in and complete their own tasks without re-onboarding (manual E2E, two profiles, one device)

#### Feature parity (Wave 1–2 features — deferred items listed, not blocking G5)
- [ ] WS-FOCUS focus timer ships in this build (client-only v1 — no server session logging)
- [ ] WS-PAUSE rest state shows "Je hebt even rust" when `GET /members/:id/pause` returns active pause
- [ ] WS-PROPOSAL teen "Vraag een taak aan" ships with stub fallback when API not yet live
- [x] Multi-child picker — **deferred** (larger scope; see "Shared-device multi-child profile picker" note above). Track in follow-up PR.

#### Accessibility
- [ ] Dynamic Type: all child-facing text scales to at least XXXL without clipping
- [ ] VoiceOver: every interactive control has a meaningful `accessibilityLabel`; no unlabeled buttons
- [ ] Touch targets ≥ 44 pt (≥ 64 pt for Young mode); verified on iPhone SE (smallest layout)
- [ ] Reduce Motion: celebrations, confetti, and focus timer ring animation all degrade gracefully

#### Privacy & compliance
- [ ] No child name, photo URL, or PII appears in crash reports, analytics, or console logs
- [ ] Lockscreen push text is generic (no task name, child name, or photo details)
- [ ] Camera / Face ID usage strings use productnaam **Wispel** (not TaakHelden)
- [ ] DPIA starter reviewed: `docs/taakhelden-dpia-starter.md`

#### Build & environment
- [ ] Release entitlements: `aps-environment = production`
- [ ] API base URL in Release Info.plist points to production Worker: `https://taakhelden-api.oostelaar.workers.dev/v1` (rename follows WS-INFRA)
- [ ] `npm run openapi:check` passes (contract snapshot matches `packages/shared`)
- [ ] No `.dev.vars` secrets bundled in the archive

#### App Store Connect
- [ ] App icon uploaded (1024×1024 px, no alpha channel)
- [ ] Screenshots uploaded for 6.7" (iPhone 15 Pro Max) and 12.9" (iPad Pro) — required sizes
- [ ] Privacy labels filled: Photos or Videos, Contact Info, Identifiers — **no Tracking** (no third-party analytics SDK)
- [ ] Age rating: 4+ (no user-generated content from children visible to others; family-gated)
- [ ] Keywords and description reference **Wispel** (not TaakHelden)

---

## Gerelateerde docs

- E2E-checklist (2 devices): `docs/ios-phase1-e2e-checklist.md`
- DPIA starter: `docs/taakhelden-dpia-starter.md`
- Privacy minimum: `docs/taakhelden-privacy-minimum.md`
- ADR review constraints: `docs/adr/ADR-0003-ios-family-app-shell-and-review-constraints.md`
- Brand sheet: `docs/brand/wispel-brand-v1.md`
