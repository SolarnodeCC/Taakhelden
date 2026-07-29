# App Review notes — TaakHelden (familie-app)

TaakHelden wordt in de App Store gepositioneerd als **familie-app**. De listing
blijft family-first en niet child-primary (niet Kids Category).

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
6. Open de ouderpoort via **Mijn Held**: houd ~1,5 s vast op het scherm (hinttekst
   onderaan), of tik vijf keer. Alternatief: VoiceOver → “Open ouderpoort” op de avatar.
7. Bevestig dat Face ID / toestelcode **eerst** vereist is; pas daarna verschijnen
   ouderinstellingen. Kind-PIN opent die poort niet.
8. Account verwijderen: Instellingen → account wissen (SIWA-herbevestiging).

## Build / environment (voor reviewers & CI)

- **Release** builds gebruiken `https://taakhelden-api.oostelaar.workers.dev/v1`
  (Info.plist `TAAKHELDEN_API_BASE_URL`). Debug gebruikt localhost voor lokale API.
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

## Gerelateerde docs

- E2E-checklist (2 devices): `docs/ios-phase1-e2e-checklist.md`
- DPIA starter: `docs/taakhelden-dpia-starter.md`
- Privacy minimum: `docs/taakhelden-privacy-minimum.md`
- ADR review constraints: `docs/adr/ADR-0003-ios-family-app-shell-and-review-constraints.md`
