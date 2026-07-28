# App Review notes — TaakHelden (familie-app)

TaakHelden wordt in de App Store gepositioneerd als **familie-app**. De listing
blijft family-first en niet child-primary.

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
6. Open de verborgen ouderpoort via **lang indrukken** op **Mijn Held**
   (alternatief: vijf keer tikken).
7. Bevestig dat Face ID / toestelcode **eerst** vereist is; pas daarna verschijnen
   ouderinstellingen. Kind-PIN opent die poort niet.

## Compliance notes

- Voor kinderen onder 13 blijft **Gebruik pincode** altijd zichtbaar naast Face ID.
- Foto-bonus gebruikt alleen camera of PHPicker (geen volledige fotobibliotheek).
- Lockscreen pushtekst blijft generiek; geen taaknaam, kindnaam of fotodetails.
- De app werkt volledig zonder pushmeldingen (geen paywall voor meldingen).
- Geluid bij taak klaar is uit te zetten via de ouderpoort (toggle).

## Gerelateerde docs

- E2E-checklist (2 devices): `docs/ios-phase1-e2e-checklist.md`
- DPIA starter: `docs/taakhelden-dpia-starter.md`
