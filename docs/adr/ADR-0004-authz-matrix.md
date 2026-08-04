# ADR-0004 — Authz-testmatrix: co-ouderschap

**Status:** Proposed (companion bij ADR-0004)  
**Datum:** 2026-08-01  
**Doel:** Verifieerbare autorisatie-invarianten voor het co-ouderschap-datamodel.
Elk rij in §2 en §3 is een verplichte test in `apps/api/test/authz/coparent.test.ts`.

---

## 1. Actoren & sessie-claims

| Actor | JWT-claims | Beschrijving |
|---|---|---|
| `parentA` | `fam=A, role=parent` | Ouder in gezin A |
| `parentB` | `fam=B, role=parent` | Ouder in gezin B (ander huishouden, zelfde kind) |
| `childInA` | `sub=fm_A, cid=ci_X, fam=A, role=child` | Kind X met actieve sessie in gezin A |
| `childInB` | `sub=fm_B, cid=ci_X, fam=B, role=child` | Dezelfde kind-identiteit X, actieve sessie in gezin B |
| `childUnrelated` | `sub=fm_C, cid=ci_Y, fam=A, role=child` | Ander kind in gezin A (niet kind X) |
| `unauthenticated` | geen JWT | Niet ingelogd |

---

## 2. Ledger & saldo — isolatie-invarianten

Dit is de meest kritische sectie. Per-family ledger betekent dat saldo en
transacties in huis A absoluut onzichtbaar zijn in huis B.

| # | Actor | Endpoint | Verwacht resultaat | Test-label |
|---|---|---|---|---|
| L1 | `childInA` | `GET /points/balance` | Saldo = SUM(ledger WHERE family_id=A AND child_identity_id=ci_X) | `child_balance_scoped_to_active_family` |
| L2 | `childInB` | `GET /points/balance` | Saldo = SUM(ledger WHERE family_id=B AND child_identity_id=ci_X) | `child_balance_different_per_family` |
| L3 | `childInA` | `GET /points/ledger` | Alleen entries met `family_id=A` | `child_ledger_no_cross_family_entries` |
| L4 | `childInB` | `GET /points/ledger` | Alleen entries met `family_id=B`; nooit entries van A | `child_ledger_b_not_visible_in_a` |
| L5 | `parentA` | `GET /members/{fm_B}/points/balance` | 403 — `fm_B` zit niet in gezin A | `parent_a_cannot_read_child_balance_in_b` |
| L6 | `parentA` | `GET /points/ledger` (gezin-overview) | Alleen ledger-entries `family_id=A`; geen entries family B | `parent_a_ledger_excludes_family_b` |
| L7 | `childInA` | Afvinken taak (POST /instances/{id}/complete) | Ledger-entry aangemaakt met `family_id=A` | `complete_task_creates_ledger_entry_family_a` |
| L8 | `childInB` | Dezelfde taak nogmaals afvinken in B | Levert aparte ledger-entry `family_id=B`; idempotency-key per context | `cross_family_task_completion_independent` |

---

## 3. Kind-data — gezinsgrens

| # | Actor | Endpoint | Verwacht resultaat | Test-label |
|---|---|---|---|---|
| K1 | `childInA` | `GET /instances/today` | Alleen instanties `family_id=A` | `child_today_scoped_to_active_family` |
| K2 | `childInA` | `GET /instances/today` | Geen instanties van gezin B (ook al heeft dezelfde `cid`) | `child_today_no_cross_family_instances` |
| K3 | `childInA` | `GET /rewards` | Alleen beloningen `family_id=A` | `child_rewards_scoped_to_family` |
| K4 | `childInA` | `GET /badges/me` | Badges geassocieerd met `fm_A` (of `ci_X` waar van toepassing) | `child_badges_scoped_correctly` |
| K5 | `childInA` | `GET /families/me` | Gezin A info; GEEN info over gezin B | `child_family_me_no_cross_family` |
| K6 | `parentA` | `GET /members` | Lijst bevat kindprofielen van gezin A; `fm_B` staat er NIET in | `parent_a_members_excludes_family_b_memberships` |
| K7 | `parentB` | `GET /members` | Lijst bevat `fm_B`; NIET `fm_A` | `parent_b_members_excludes_family_a_memberships` |
| K8 | `childUnrelated` | `GET /points/balance` voor `ci_X` | Kan eigen saldo zien; niet dat van `ci_X` | `unrelated_child_cannot_read_sibling_identity` |

---

## 4. Ouder-cross-family — blokkering

| # | Actor | Endpoint | Verwacht resultaat | Test-label |
|---|---|---|---|---|
| P1 | `parentA` | `GET /families/B/...` (willekeurig) | 403 — `family_id=B` != `fam`-claim | `parent_cannot_access_other_family` |
| P2 | `parentA` | `PATCH /members/fm_B` | 403 — fm_B is niet in gezin A | `parent_cannot_modify_other_family_membership` |
| P3 | `parentA` | `POST /points/adjust` met `childId=fm_B` | 403 | `parent_cannot_adjust_other_family_child_points` |
| P4 | `parentA` | `GET /members/{fm_A_child}/avatar` | 200 — wel toegestaan, eigen gezin | `parent_can_read_own_family_child_avatar` |
| P5 | `parentA` | `GET /child-identities/{ci_X}` (indien endpoint bestaat) | 200 — basisinfo (roepnaam, avatar) zichtbaar als ci_X lid is van gezin A | `parent_can_read_identity_if_member_of_own_family` |
| P6 | `parentA` | `GET /child-identities/{ci_Y}` (kind niet in gezin A) | 403 | `parent_cannot_read_identity_of_nonmember` |

---

## 5. Kind-identity — gezinspicker & context-switch

| # | Actor | Actie | Verwacht resultaat | Test-label |
|---|---|---|---|---|
| C1 | `unauthenticated` (gezinscode A) | `POST /auth/family-code` | Retourneert `memberships` voor gezin A; GEEN data gezin B | `family_code_returns_only_target_family_members` |
| C2 | `childInA` | `POST /auth/child-session/switch-family` (targetMembership=fm_B) | Vereist PIN van fm_B; succesvol → nieuw JWT met `fam=B, sub=fm_B` | `context_switch_requires_target_family_pin` |
| C3 | `childInA` | `POST /auth/child-session/switch-family` met foute PIN (5×) | Lock op `fm_B.pin_locked_until`; GEEN impact op `fm_A.pin_locked_until` | `context_switch_pin_lock_is_per_membership` |
| C4 | `childInA` | `POST /auth/child-session/switch-family` naar `fm_C` (niet van ci_X) | 403 — ci_X is geen lid van dat lidmaatschap | `context_switch_rejects_unowned_membership` |
| C5 | `childInA` | Toegang na `fm_B.status = 'suspended'` | 403 op switch; bestaande sessie A onaangetast | `suspended_membership_blocks_switch_not_other_session` |

---

## 6. Tweede-gezin-uitnodiging

| # | Actor | Actie | Verwacht resultaat | Test-label |
|---|---|---|---|---|
| I1 | `parentA` | `POST /families/me/invite-child-identity` (`ciId=ci_X`) | Alleen toegestaan als `parentA` bestaande toestemming-ouder is, of ci_X is aangemaakt in gezin A | `only_consent_parent_can_invite_identity` |
| I2 | `parentB` | Accepteert uitnodiging voor ci_X | Maakt `family_membership(ci_X, familyB)` aan; punten starten op 0 in B | `second_household_membership_starts_fresh_ledger` |
| I3 | `parentB` | Accepteert uitnodiging — gezin B bekijkt ci_X-ledger na accept | Ledger B is leeg; ledger A ongewijzigd | `invitation_acceptance_does_not_copy_ledger` |

---

## 7. Algemene structurele garanties

De volgende garanties moeten naast de per-endpoint tests gelden voor **alle** repo-functies
die gegevens over kinderen opvragen:

```
INVARIANT-1: Elk SELECT op points_ledger bevat WHERE family_id = :familyId
INVARIANT-2: Elk SELECT op task_instances bevat WHERE family_id = :familyId
INVARIANT-3: Elk SELECT op family_memberships bevat WHERE family_id = :familyId
             TENZIJ het gaat om de identity-resolve stap in auth (pin-verify)
INVARIANT-4: child_identities worden nooit geretourneerd zonder JOIN op
             family_memberships WHERE family_id = :familyId
INVARIANT-5: JWT-claim fam is nooit absent op child-routes; middleware werpt 401
             als fam ontbreekt; 403 als fam ≠ gezochte family_id
```

---

## 8. Teststructuur (implementatie-hint)

```
apps/api/test/authz/
├── coparent-ledger.test.ts       # sectie 2 (L1–L8)
├── coparent-child-data.test.ts   # sectie 3 (K1–K8)
├── coparent-parent-cross.test.ts # sectie 4 (P1–P6)
├── coparent-context-switch.test.ts # sectie 5 (C1–C5)
└── coparent-invite.test.ts       # sectie 6 (I1–I3)
```

Tests draaien in de `@cloudflare/vitest-pool-workers` Workers-runtime met een
Miniflare-sandbox per test-suite. Elke test seeded zijn eigen `child_identities`,
`family_memberships` en `points_ledger` rows.

**Vereiste fixtures:**

```typescript
// test/fixtures/coparent.ts (te maken bij implementatie)
export const FAMILY_A = 'fam_test_A';
export const FAMILY_B = 'fam_test_B';
export const CHILD_IDENTITY_X = 'ci_test_X';
export const MEMBERSHIP_A = 'fm_test_A';  // ci_X in fam_A
export const MEMBERSHIP_B = 'fm_test_B';  // ci_X in fam_B
export const CHILD_IDENTITY_Y = 'ci_test_Y'; // niet-gerelateerd kind in fam_A
export const MEMBERSHIP_C = 'fm_test_C';  // ci_Y in fam_A
```

---

## 9. Scope van dit document

Dit document definieert **authz-regels** — wat mag en wat mag niet. Het is geen
uitputtende API-documentatie. De Zod-schemas en endpoint-contracts staan in
`docs/taakhelden-api-specificatie.md` en `packages/shared`.

De matrix is leidend bij code-review van co-ouderschap-PR's: elke nieuwe query of
endpoint moet aantoonbaar voldoen aan de invarianten in §7.

---

## Referenties

- `docs/adr/ADR-0004-coparenting-data-model.md` (primaire ADR)
- `docs/taakhelden-api-specificatie.md` §8 (bestaande authz-matrix enkelvoudig gezin)
- `apps/api/test/authz/` (bestaande authz-tests als implementatie-template)
