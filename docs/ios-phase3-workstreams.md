# iOS Phase 3 — workstreams (uitvoering)

*Operationele opsplitsing van `docs/ios-phase3-plan.md`. Basis: Phase 2 complete ([#78](https://github.com/SolarnodeCC/Taakhelden/pull/78)).*

**Status:** in uitvoering — slices **3a–3f** landen in deze PR; E4–E8 volgen.

---

## Workstream-kaart

| Slice | Epic | Lagen | Status |
|---|---|---|---|
| **3a** | E0 Young-mode design pass | iOS DesignSystem + Child shell | Done (code) |
| **3b** | E1 EN-locale uitbreiden | `nl`/`en` Localizable + kind-strings | Done (code) |
| **3c** | E2 Avatar-catalogus contract | shared + migratie `0008` + API + authz | Done (code) |
| **3d** | E2 Avatar-shop iOS | Mijn Held shop UI + API client | Done (code) |
| **3e** | E3 Gezinsdoelen contract | shared + migratie `0008` + API + authz | Done (code) |
| **3f** | E3 Gezinsdoelen iOS | Kind-kaart + ouder-settings | Done (code) |
| **3g** | E4 Onderhandel-knop (teen) | shared + API + iOS + ouder-queue | Planned |
| **3h** | E5 Huiswerk-focustimer | iOS FocusTimer (+ optioneel Live Activity) | Planned |
| **3i** | E6 Widget polish + Watch | XcodeGen widget + watchOS target | Planned |
| **3j** | E7 Co-ouderschap | ADR-0004 workshop → pas daarna code | Blocked on ADR |
| **3k** | E8 Break-glass | API audit + runbook (geen kind-UI) | Planned |

---

## Slice 3a — Young-mode (E0)

**Doel:** near-textless kind-shell wanneer `ageBand == .young`.

| Deliverable | Detail |
|---|---|
| `YoungModeChrome` | Grote targets (≥64 pt), icon-first labels, Speak-knop |
| Mijn Dag young | Taken als grote kaarten; Klaar! ≥64 pt; TTS op titel |
| Unlock | Picture-PIN practice + zichtbare numerieke PIN (bestaand) |
| Tests | `YoungModeSupport` unit + picture-PIN match |

**Niet in 3a:** server-side picture-PIN opslag (ADR later).

---

## Slice 3b — EN-locale (E1)

**Doel:** kind-chrome + celebrations + avatar/goal strings in NL + EN.

| Deliverable | Detail |
|---|---|
| Keys | `child.*`, `held.*`, `avatar.*`, `goal.*` |
| Views | `ChildShellView` / Held / Young → `String(localized:)` |
| Gap | Ouder-strings al grotendeels via #78 |

---

## Slice 3c/3d — Avatar-shop (E2)

**Contract:**

- `GET /avatar-catalog` — static catalog
- `GET /members/:id/avatar` — equipped + unlocked (derived)
- `PATCH /members/:id/avatar` — equip (idempotent); child own-only

**Unlock:** level (`lifetimeEarned / 100`) of `lifetimePoints` of badge — **geen** puntenaftrek.

**DB:** `avatar_catalog` seed + `users.equipped_*` kolommen (migratie `0008`).

---

## Slice 3e/3f — Gezinsdoelen (E3)

**Contract:**

- `GET /families/me/goals` / `POST` / `PATCH /:id`
- `GET /families/me/goals/active/progress`

**Progress:** `SUM(positive ledger)` sinds `started_at` voor geselecteerde children — nooit saldo.

**DB:** `family_goals` (migratie `0008` of `0009` samen met avatar).

**UI:** kind-kaart op Mijn Dag; ouder-settings achter gate.

---

## Slice 3g–3k — later

Zie `docs/ios-phase3-plan.md` §6–10. **3j** start pas na ADR-0004 goedkeuring.

---

## Definition of Done (per slice)

1. Zod in `packages/shared` + export + OpenAPI/Swift regenerate waar van toepassing  
2. Repo `familyId`-eerste arg; geen SQL in routes  
3. Authz-test (cross-family + rol)  
4. Positieve NL-copy; EN-pariteit voor nieuwe keys  
5. `npm test` / typecheck groen voor geraakte workspaces  
6. Geen negatieve mechanieken; geen kind-PII in logs  

---

## Volgorde deze PR

1. Workstreams-doc (dit bestand)  
2. Migratie `0008` (avatar + goals)  
3. Shared schemas + API + tests (3c, 3e)  
4. iOS young + i18n + avatar shop + goal card (3a, 3b, 3d, 3f)  
5. OpenAPI/Swift contract sync  

E4–E8 bewust **niet** in deze eerste bouwronde.
