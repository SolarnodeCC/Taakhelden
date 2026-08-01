# ADR-0004: Co-ouderschap — datamodel

**Status:** Proposed — awaiting PO + security sign-off  
**Datum:** 2026-08-01  
**Workstream:** WS-COPARENT (iOS Phase 3 Epic E7)  
**Blokkeert:** iOS Phase 3 Epic E7, API-migraties, web co-ouderflows  
**PO-besluit (P6, 2026-08-01):** Optie A + per-family ledger — vastgelegd in dit document.

---

## Context

Wispel ondersteunt vandaag één `family` per kindprofiel. In de Nederlandse markt is
co-ouderschap over twee huishoudens een veelgevraagde feature (productvoorstel §7,
iOS bouwvoorstel §11 Fase 3).

Het huidige schema slaat kinderen op in de `users`-tabel met een vaste `family_id`. Een
kind heeft precies één gezinslidmaatschap; punten, taken en beloningen zijn volledig aan
dat ene gezin gebonden.

Het bouwvoorstel waarschuwt expliciet: *"niet half modelleren"* — geen voorbereidende
kolommen of UI tot dit ADR is besloten.

---

## Beslissing

**Optie A — Eén kind-identiteit, meerdere gezinslidmaatschappen, per-family ledger.**

### Kernkeuzes

| Vraag | Antwoord |
|---|---|
| Één of twee kindrecords? | **Eén** `child_identity` per echt kind |
| Gedeelde of gescheiden puntenpot? | **Gescheiden** — ledger scoped op `(child_identity_id, family_id)` |
| Gedeelde of gescheiden avatar/roepnaam? | **Gedeeld** — identiteitsdata in `child_identities` |
| Gedeelde of gescheiden taken/beloningen? | **Gescheiden** — per `family_id`, zoals vandaag |
| JWT-claims kind? | `sub` = `family_memberships.id`; `cid` = `child_identity_id`; `fam` = `active_family_id` |

De per-family ledger is de centrale keuze: punten bij mama zijn **niet** zichtbaar bij
papa. Dit minimaliseert juridische onduidelijkheid over gezamenlijk ouderlijk gezag over
een gedeelde puntenpot, en houdt de `familyId`-repo-grens als enige security-scope.

---

## Datamodel (Proposed — Migration sketch)

### Nieuwe tabellen

```sql
-- child_identities: kanonieke identiteit van een echt kind (cross-family)
-- Bevat ALLEEN dataminimaal profiel: geen e-mail, geen contactinfo.
CREATE TABLE child_identities (
  id            TEXT PRIMARY KEY,          -- prefix: ci_
  display_name  TEXT NOT NULL,             -- roepnaam (geen achternaam)
  birth_year    INTEGER,                   -- privacyvriendelijk (geen geboortedatum)
  age_mode      TEXT NOT NULL DEFAULT 'mid'
                CHECK (age_mode IN ('young','mid','teen')),
  avatar_id     TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at    TEXT                       -- soft delete; vereist toestemming alle gezinnen
);

-- family_memberships: koppeltabel kind-identiteit ↔ gezin
-- Vervangt uiteindelijk de child-rijen in users; in Fase 1 parallel.
CREATE TABLE family_memberships (
  id                  TEXT PRIMARY KEY,    -- prefix: fm_  (dit wordt sub in kind-JWT)
  child_identity_id   TEXT NOT NULL REFERENCES child_identities(id),
  family_id           TEXT NOT NULL REFERENCES families(id),
  pin_hash            TEXT,               -- per-family PIN (argon2); mag afwijken per huis
  pin_locked_until    TEXT,
  consent_by          TEXT REFERENCES users(id),   -- welke ouder gaf toestemming (AVG art. 8)
  consent_at          TEXT,
  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','suspended','removed')),
  invited_by          TEXT REFERENCES users(id),   -- tweede huis: welke ouder nodigde uit
  invited_at          TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (child_identity_id, family_id)
);
CREATE INDEX idx_fm_family ON family_memberships(family_id, status);
CREATE INDEX idx_fm_identity ON family_memberships(child_identity_id);
```

### Gewijzigde tabellen (Fase 2 — na sign-off)

`points_ledger` krijgt een additionele FK naar `child_identities`:

```sql
-- Bestaande kolom child_id blijft; voeg toe:
ALTER TABLE points_ledger ADD COLUMN child_identity_id TEXT REFERENCES child_identities(id);
ALTER TABLE task_instances ADD COLUMN child_identity_id TEXT REFERENCES child_identities(id);
-- Backfill via child_id → family_memberships.id → child_identity_id
-- Na backfill: NOT NULL-constraint in Fase 3 migration.
```

`child_device_sessions` scoped op membership i.p.v. `child_id`:

```sql
ALTER TABLE child_device_sessions ADD COLUMN membership_id TEXT REFERENCES family_memberships(id);
-- Bestaand child_id blijft voor backwards-compat tijdens migratie.
```

### Migration sketch (append-only nummering)

| Migratienummer | Inhoud |
|---|---|
| `0009_coparent_identity_tables.sql` | CREATE `child_identities`, `family_memberships` |
| `0010_coparent_backfill.sql` | INSERT backfill: bestaande child-users → ci_ + fm_ rows |
| `0011_coparent_ledger_fk.sql` | ADD `child_identity_id` op `points_ledger`, `task_instances` |
| `0012_coparent_sessions_fk.sql` | ADD `membership_id` op `child_device_sessions` |
| `0013_coparent_notnull.sql` | Zet `child_identity_id NOT NULL` na data-validatie productie |

Migraties 0009–0013 worden pas aangemaakt na PO + security sign-off. Elke migratie heeft
een `.verify.sql` die de invarianten bevestigt.

---

## Auth-model: kind-sessie

### Huidig JWT (child)

```json
{ "sub": "<users.id>", "fam": "<family_id>", "role": "child" }
```

### Proposed JWT (child, na Fase 2)

```json
{
  "sub": "<family_memberships.id>",   // mbr-context; uniek per sessie/family
  "cid": "<child_identities.id>",     // wie het kind is, cross-family
  "fam": "<family_id>",               // actief huis voor deze sessie
  "role": "child",
  "exp": 1234567890
}
```

**Gevolgen voor auth-repo's:**

- `POST /auth/family-code` → response bevat `memberships` (lijst van `{ membershipId, familyName }`) wanneer kind in meerdere gezinnen zit; iOS toont gezinspicker vóór PIN-invoer.
- `POST /auth/child-session` → body uitgebreid met `membershipId` (optioneel; backwards-compat: `childId` blijft werken zolang `users`-tabel geldig is).
- `POST /auth/child-session/switch-family` (nieuw) → wissel actief gezin zonder opnieuw PIN in te voeren; vereist geldig `cid`-claim in huidig token.

### Sessie-isolatie garantie

Elke `family_membership` heeft een eigen `pin_hash`. Toegang tot de andere huishoud-context
vereist een expliciete context-switch met PIN-verificatie (of re-authenticatie). Dit is
een bewuste UX-keuze om onbedoeld context-wisselen te voorkomen.

---

## Rollback-strategie

De migraties zijn addief-only (nieuwe tabellen, nieuwe kolommen). De bestaande `users`-tabel
en alle bestaande FKs blijven intact gedurende de migratiefasen.

| Fase | Rollback |
|---|---|
| Na 0009 (alleen DDL) | DROP `family_memberships`, DROP `child_identities` — geen data-verlies |
| Na 0010 (backfill) | DROP met backfill; legacy `users` rows zijn niet aangeraakt |
| Na 0011–0012 (FK toevoegen) | Kolommen droppen; NOT NULL is nog niet gezet |
| Na 0013 (NOT NULL) | **Geen eenvoudige rollback** — vereist data-herstel uit backup |

**Aanbeveling:** migraties 0009–0012 deployen met feature-flag; 0013 alleen zetten na
productie-validatie van de backfill. Dit geeft een veilig rollback-venster van minimaal
één deployment-cyclus per fase.

---

## Zod-schemas in `packages/shared` (te maken bij implementatie)

```typescript
// packages/shared/src/schemas/coparent.ts  (niet aanmaken vóór sign-off)

export const ChildIdentity = z.object({
  id: z.string(),
  displayName: z.string(),
  birthYear: z.number().int().optional(),
  ageMode: z.enum(['young', 'mid', 'teen']),
  avatarId: z.string().nullable(),
});

export const FamilyMembership = z.object({
  id: z.string(),
  childIdentityId: z.string(),
  familyId: z.string(),
  familyName: z.string(),       // joined voor iOS-picker
  status: z.enum(['active', 'suspended', 'removed']),
  consentAt: z.string().optional(),
});

export const FamilyMembershipSummary = z.object({
  membershipId: z.string(),
  familyName: z.string(),
  childDisplayName: z.string(),
  avatarId: z.string().nullable(),
  ageMode: z.enum(['young', 'mid', 'teen']),
});

// Uitbreiding op ChildSessionBody:
export const ChildSessionBodyV2 = z.object({
  familyCode: z.string().length(6),
  membershipId: z.string().optional(),  // nieuw; backwards-compat met childId
  childId: z.string().optional(),       // legacy; deprecated na Fase 3
  pincode: z.string().regex(/^\d{4}$/),
});

export const ChildSwitchFamilyBody = z.object({
  targetMembershipId: z.string(),
  pincode: z.string().regex(/^\d{4}$/),
});
```

---

## Gevolgen per laag

| Laag | Werk bij E7-implementatie |
|---|---|
| **D1** | Migraties 0009–0013 (zie schema); backfill-script met validatie |
| **API — auth** | `child-session` uitbreiden; `switch-family` endpoint toevoegen; JWT-claims uitbreiden |
| **API — repo's** | Alle child-repo's accepteren al `familyId` als eerste arg — dit blijft de primaire scope; `child_identity_id` wordt tweede filter waar nodig |
| **FamilyRoom-DO** | Ledger-writes krijgen `child_identity_id` in het event-payload (audit); `family_id` blijft de DO-sleutel |
| **iOS** | Gezinspicker vóór PIN-invoer; context-switch flow; `FamilyRoomClient` activeFamily-state |
| **Web** | Uitnodigingsflow tweede ouder; gezinsinstellingen tonen welke identities aanwezig zijn |
| **packages/shared** | `coparent.ts` schema aanmaken vóór eerste PR |

---

## Niet-doelen

- Gedeelde puntenpot over twee huishoudens (bewust afgewezen)
- Automatische merge van bestaande gezinnen zonder ouder-consent
- Zichtbaarheid van taken/beloningen/badges van huis A in huis B
- Phase 3 UI of API stubs vóór goedkeuring van dit ADR

---

## Hard-rules compliance

| Regel | Status |
|---|---|
| **No SQL in routes** | Alle nieuwe queries leven in repo-functies; `familyId` blijft first arg |
| **familyId boundary** | Per-family ledger versterkt de grens; `child_identity_id` geeft nooit cross-family toegang |
| **Idempotency** | `switch-family` + nieuwe auth-endpoints vereisen `Idempotency-Key` |
| **Ledger source of truth** | Punten = `SUM(points_ledger WHERE child_identity_id=X AND family_id=Y)` — nooit een balanskolom |
| **No negative mechanics** | Geen mechanisme om punten van de andere household te zien of te beïnvloeden |
| **Child privacy** | `child_identities` bevat geen e-mail/contactinfo; alleen roepnaam, geboortejaar, age_mode, avatar |
| **Zod validation** | `packages/shared/src/schemas/coparent.ts` aanmaken vóór eerste implementatie-PR |

---

## Risico's

| Risico | Ernst | Mitigatie |
|---|---|---|
| Backfill faalt gedeeltelijk in productie | Hoog | `.verify.sql` per migratie; feature-flag; rollback-venster per fase |
| Twee huishoudens zien elkaars ledger via bug | Hoog | Per-family authz-test matrix (zie `ADR-0004-authz-matrix.md`) |
| JWT-claim-uitbreiding breekt bestaande iOS-clients | Hoog | Addief: `cid` is optioneel in Fase 1; `sub` = `family_memberships.id` vervangt `users.id` geleidelijk |
| Kind kan PIN van huis B raden en context switchen | Midden | Context-switch vereist PIN van doellidmaatschap; rate-limit + lock identiek aan huidig |
| Roepnaam-update in huis A zichtbaar in huis B | Laag | `display_name` zit op `child_identities` (bewust gedeeld); ouders moeten dit weten → DPIA + UI-tekst |
| AVG: gezamenlijke verwerkingsverantwoordelijkheid | Hoog | DPIA-update vereist vóór second-household go-live; juridisch advies over verantwoordelijkheidsregeling |
| Badges in twee huizen (shared of per-family?) | Midden | Expliciet uitgesteld naar aparte micro-ADR |

---

## Exit-criteria voor sign-off

- [x] PO (P6) akkoord op Optie A + per-family ledger
- [ ] Security sign-off op JWT-uitbreiding + context-switch flow
- [ ] DPIA-paragraaf co-ouderschap ingevuld (`docs/taakhelden-dpia-starter.md` §5a)
- [ ] Authz-testmatrix compleet (`docs/adr/ADR-0004-authz-matrix.md`)
- [ ] `docs/ios-phase3-plan.md` §9 bijgewerkt met definitief model-pointer
- [ ] Migratienummers 0009–0013 gereserveerd (bestanden niet aangemaakt vóór sign-off)
- [ ] Juridisch advies gezamenlijke verwerkingsverantwoordelijkheid

---

## Opties afgewezen

### Optie B — Gekoppelde dubbele profielen
Twee `users`-records met `linked_member_id`. Afgewezen omdat:
- Dubbele avatar/roepnaam leidt tot sync-conflicten
- Puntensaldo-som is niet eenduidig uit te leggen
- Geen helder datamodel-antwoord op "wie heeft toestemming gegeven"

### Optie C — Primair gezin + gast-leestoegang
Afgewezen omdat read-only toegang de NL co-ouderschap-usecases niet afdekt. Beide
huishoudens willen eigen taken en eigen beloningsbeleid.

---

## Referenties

- `docs/adr/ADR-0004-authz-matrix.md` — authz-testmatrix (companion)
- `docs/ios-phase3-plan.md` §9 (Epic E7 beschrijving + exit-criteria)
- `docs/taakhelden-dpia-starter.md` §5a (co-ouderschap DPIA-paragraaf)
- `docs/taakhelden-productvoorstel.md` §7
- `docs/taakhelden-api-specificatie.md` §3.1 (auth-endpoints)
- `apps/api/migrations/0001_init.sql` (huidig schema)
- `packages/shared/src/schemas/auth.ts` (huidige auth-schemas)
