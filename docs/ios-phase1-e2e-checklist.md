# iOS Phase 1 — E2E checklist (2 devices)

Gebruik deze checklist op **staging** met een ouder-iPhone en kind-iPhone/iPad.
Vink af vóór Phase 2 start.

## Voorbereiding

- [ ] Staging Worker draait met recente migraties
- [ ] `TAAKHELDEN_API_BASE_URL` wijst naar staging in review/debug build
- [ ] Apple Sandbox-account voor Sign in with Apple (ouder)
- [ ] Review-gezin aangemaakt; gegevens in `apps/ios/ReviewNotes.md` bijgewerkt

## Ouder-device

- [ ] Sign in with Apple → gezin aangemaakt
- [ ] Kindprofiel + PIN aangemaakt via ouder-onboarding
- [ ] Gezinscode zichtbaar en noteerbaar
- [ ] (Optioneel) Push toestaan → generieke melding op lockscreen

## Kind-device

- [ ] Gezinscode + profiel + PIN → koppeling slaagt
- [ ] Dagelijks ontgrendelen: Face ID **én** zichtbare pincode (kind < 13)
- [ ] Mijn Dag: taak afvinken → haptic + (confetti of reduce-motion alternatief)
- [ ] Offline: vliegtuigstand → afvinken → sync-indicator → sync bij verbinding
- [ ] Winkel: beloningen zichtbaar, "nog X punten"-copy bij te duur
- [ ] Foto-bonus: camera **of** picker (geen full library permission)
- [ ] Mijn Held: level uit lifetimeEarned, niet uit saldo

## Parental gate (kind-device)

- [ ] Geen ouder-tab in kindmodus
- [ ] Verborgen gebaar opent ouderpoort
- [ ] Kind-PIN opent poort **niet**
- [ ] Device-owner auth vereist

## App Review-pakket

- [ ] `ReviewNotes.md` ingevuld met staging gezinscode + kind-PIN
- [ ] One-device flow gedocumenteerd voor Apple Review
