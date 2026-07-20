# TaakHelden — API-specificatie (v1)
*Cloudflare Worker (Hono + TypeScript), REST/JSON. Contract gedefinieerd in Zod (`packages/shared`), daaruit OpenAPI → Swift-modellen.*

---

## 1. Uitgangspunten

- **Base URL**: `https://api.taakhelden.nl/v1` (staging: `api-staging.…`)
- **Auth**: `Authorization: Bearer <JWT>` op alles behalve `/auth/*` en `/health`.
- **JWT-claims**: `sub` (user_id), `fam` (family_id), `role` (`parent` | `child`), `exp`. Kind-tokens: 24 u geldig; ouder-tokens: 1 u access + 30 d refresh.
- **Autorisatie**: middleware bindt élke query aan `fam`; rol-checks per endpoint (matrix in §8). Cross-family toegang is per definitie onmogelijk in de repository-laag.
- **Idempotency**: mutaties vanaf de iOS-app sturen een `Idempotency-Key` header (UUID). Essentieel voor offline sync — dubbel afvinken mag nooit dubbele punten geven.
- **Tijd**: alles in UTC (ISO 8601); gezin heeft een `timezone` (IANA) voor dagafbakening, bedtijd en cron-logica.
- **Versioning**: pad-versie (`/v1`); breaking changes → `/v2`, oude versie minimaal 6 maanden in de lucht (iOS-gebruikers updaten traag).

### Foutmodel (uniform)

```json
{
  "error": {
    "code": "TASK_ALREADY_COMPLETED",
    "message": "Deze taak is al afgevinkt.",
    "details": { "instanceId": "ti_abc" }
  }
}
```

HTTP-codes: 400 validatie · 401 geen/verlopen token · 403 rol/gezin · 404 · 409 conflict (idempotency/status) · 429 rate limit. `code` is machine-leesbaar en stabiel; `message` mag de app tonen (NL, kindvriendelijk waar relevant).

### Paginatie
Cursor-based: `?limit=50&cursor=…` → response bevat `nextCursor` (null = einde). Alleen op ledger, foto-historie en instance-historie; dagelijkse lijsten zijn klein genoeg zonder.

---

## 2. Resource-overzicht

```
/auth          registratie, login, refresh, kind-sessies
/families      gezin, instellingen, uitnodigingscode
/members       ouder- en kindprofielen, avatars
/tasks         taakdefinities + templates
/instances     dagelijkse taak-instanties: afvinken, goedkeuren
/photos        presigned upload + bevestiging
/points        saldo, ledger, bonusstatus
/rewards       beloningswinkel + inlossingen
/badges        verdiende badges
/devices       pushtoken-registratie, notificatie-instellingen
/sync          batch-sync voor offline-first iOS
/account       AVG: export & verwijdering
/ws            WebSocket (Durable Object per gezin)
```

---

## 3. Endpoints per resource

### 3.1 Auth

| Methode & pad | Rol | Beschrijving |
|---|---|---|
| `POST /auth/register` | — | Ouder-registratie (e-mail + wachtwoord). Maakt User + Family in één transactie. Turnstile-token verplicht. |
| `POST /auth/login` | — | E-mail + wachtwoord → access + refresh token. |
| `POST /auth/apple` | — | Sign in with Apple (identityToken-verificatie tegen Apple's JWKS). Nieuw of bestaand account. |
| `POST /auth/refresh` | — | Refresh token → nieuw access token (rotatie: oude refresh vervalt). |
| `POST /auth/family-code` | — | Stap 1 kind-login: gezinscode (6 tekens) → lijst kindprofielen `{id, roepnaam, avatar}` van dat gezin. Geen auth, wel zwaar rate-limited. |
| `POST /auth/child-session` | — | Stap 2: `{familyCode, childId, pincode}` → kind-JWT (24 u). 5 foutpogingen → 15 min lock + pushmelding naar ouders. |
| `POST /auth/logout` | beide | Refresh token intrekken. |

### 3.2 Families

| Methode & pad | Rol | Beschrijving |
|---|---|---|
| `GET /families/me` | beide | Gezin + instellingen. Kind krijgt een uitgeklede weergave (geen uitnodigingscode, geen leden-e-mails). |
| `PATCH /families/me` | parent | Naam, `timezone`, `quietHours` (bedtijd), `weekBonusThreshold` (default 0.8), `dayBonusPoints`, `weekBonusPoints`, `vacationMode`. |
| `POST /families/me/invite-code` | parent | (Her)genereer gezinscode; oude vervalt direct. |
| `POST /families/me/parents` | parent | Tweede ouder/verzorger uitnodigen per e-mail; `permissions: "full" \| "approve_only"`. |

### 3.3 Members

| Methode & pad | Rol | Beschrijving |
|---|---|---|
| `GET /members` | beide | Alle gezinsleden (kind ziet roepnamen + avatars, geen e-mails/geboortejaren van anderen). |
| `POST /members/children` | parent | Kindprofiel: `{roepnaam, geboortejaar, avatarId?, pincode}` → server leidt `ageMode` af (`young` 4-7 / `mid` 8-12 / `teen` 13+). Legt oudertoestemming vast (timestamp + parent_id) — AVG art. 8. |
| `PATCH /members/{id}` | parent (kind: alleen eigen avatar) | Profiel wijzigen. Kind mag alleen `avatarId` van zichzelf wijzigen. |
| `POST /members/{id}/photo` | parent | Profielfoto via presigned-flow (§3.6). |
| `POST /members/{id}/pincode` | parent | Pincode resetten. |
| `DELETE /members/{id}` | parent | Kindprofiel verwijderen (soft delete 7 d, daarna cascade — zie /account). |

### 3.4 Tasks (definities)

| Methode & pad | Rol | Beschrijving |
|---|---|---|
| `GET /tasks` | parent | Alle taakdefinities van het gezin. |
| `POST /tasks` | parent | Zie schema hieronder. |
| `PATCH /tasks/{id}` | parent | Wijzigen; werkt door op **toekomstige** instances, nooit met terugwerkende kracht op punten. |
| `DELETE /tasks/{id}` | parent | Archiveren (historie/ledger blijft intact). |
| `GET /tasks/templates?age=8` | parent | Leeftijdstemplates (statisch, uit KV-cache) → één tik "toevoegen aan gezin". |

**Taak-schema:**
```json
{
  "title": "Vaatwasser uitruimen",
  "category": "household",            // household | homework | selfcare | custom
  "icon": "dishwasher",
  "points": 15,
  "photoBonusPoints": 5,              // 0 = foto-bonus uit
  "approvalRequired": true,
  "assignees": ["ch_noor"],
  "rotation": ["ch_noor", "ch_sam"],  // optioneel: wekelijkse roulatie, overschrijft assignees
  "recurrence": { "freq": "weekly", "days": ["MO","WE","FR"] },
  "daypart": "evening",               // morning | afternoon | evening | null
  "activeFrom": "2026-08-01",
  "activeUntil": null                 // bijv. toetsdatum bij huiswerk
}
```

### 3.5 Instances (de kern van de app)

| Methode & pad | Rol | Beschrijving |
|---|---|---|
| `GET /instances/today` | beide | Kind: eigen taken van vandaag + puntenstatus + dagbonus-voortgang. Ouder: alle kinderen gegroepeerd. |
| `GET /instances?childId=&from=&to=` | parent | Historie (paginated). |
| `POST /instances/{id}/complete` | child (eigen) / parent | Afvinken. `Idempotency-Key` verplicht. Response: verdiende punten, of dag/weekbonus getriggerd is, evt. nieuwe badge → app toont confetti in één roundtrip. |
| `POST /instances/{id}/photo` | child (eigen) | Foto-bonus koppelen: `{photoId}` (na presigned upload). Status blijft `submitted` tot verwerking + evt. goedkeuring. |
| `POST /instances/{id}/approve` | parent | Goedkeuren → punten definitief in ledger, push naar kind. |
| `POST /instances/{id}/redo` | parent | `{note}`: vriendelijke toelichting, terug naar `open_redo`. **Geen puntenaftrek.** |
| `POST /instances/{id}/undo` | child (eigen, < 5 min) | Oeps-knop: afvinken ongedaan maken zolang niet goedgekeurd. |

**Statusmachine:** `open → completed | submitted → approved → (punten in ledger)` en `submitted → open_redo → submitted`. Zonder `approvalRequired` gaat `complete` direct naar `approved`.

### 3.6 Photos (presigned-flow)

```
1. POST /photos/upload-intent  { "purpose": "task", "instanceId": "ti_x",
                                 "contentType": "image/heic", "bytes": 2400000 }
   → { "photoId": "ph_y", "uploadUrl": "<presigned R2 PUT, 5 min>" }
2. App PUT't de foto rechtstreeks naar R2.
3. POST /photos/{photoId}/confirm
   → Queue-job: EXIF/GPS strippen, thumbnail, status "ready".
4. GET /photos/{photoId} → korte signed GET-URL (5 min), alleen eigen gezin.
```
Limieten: max 10 MB, alleen `image/jpeg|heic|png`, max 20 uploads/kind/dag. R2-lifecycle verwijdert taakfoto's na 30 dagen; profielfoto's zijn uitgezonderd (eigen prefix).

### 3.7 Points

| Methode & pad | Rol | Beschrijving |
|---|---|---|
| `GET /points/balance` | beide | Kind: eigen saldo + dag/week-voortgang + streak. Ouder: alle kinderen. |
| `GET /points/ledger?childId=` | beide (kind: eigen) | Paginated grootboek: `{type: task|day_bonus|week_bonus|redemption|adjustment, amount, ref, at}` — "waar komen mijn punten vandaan?" |
| `POST /points/adjust` | parent | Handmatige bijboeking mét reden (bijv. taak buiten de app om). Alleen positief; negatieve correcties alleen via redemption-annulering. |

Saldo = som van de ledger, berekend in de Durable Object van het gezin (serialisatie voorkomt race conditions bij simultaan afvinken). Dag- en weekbonussen worden **transactioneel bij de laatste kwalificerende `complete`** geboekt, niet door een aparte cron — directe feedback in de app.

### 3.8 Rewards

| Methode & pad | Rol | Beschrijving |
|---|---|---|
| `GET /rewards` | beide | Winkel (kind ziet alleen actieve, betaalbare markering + spaarvoortgang op gepinde beloning). |
| `POST /rewards` / `PATCH /rewards/{id}` / `DELETE` | parent | Beheer: `{title, icon, price, limitPerWeek?}`. |
| `POST /rewards/{id}/redeem` | child | Kopen → ledger-afboeking + status `pending` + push naar ouder. Idempotency-Key verplicht. |
| `POST /redemptions/{id}/fulfill` | parent | Markeer als ingelost. |
| `POST /redemptions/{id}/cancel` | parent | Annuleren → punten terug (ledger-tegenboeking). |
| `POST /rewards/{id}/pin` | child | Spaardoel instellen (max 1). |

### 3.9 Badges
`GET /badges` (beide; kind: eigen). Badges worden server-side toegekend in dezelfde transactie als `complete`/bonus en meegegeven in de complete-response.

### 3.10 Devices & notificaties

| Methode & pad | Rol | Beschrijving |
|---|---|---|
| `POST /devices` | beide | `{apnsToken, platform, userId}` — token per profiel (gedeeld iPad-scenario: token kan aan meerdere profielen hangen). |
| `DELETE /devices/{token}` | beide | Bij uitloggen. |
| `GET/PATCH /notification-settings` | parent | Per kind: aan/uit, tijdvensters; kind-instellingen beheert de ouder. |

### 3.11 Sync (offline-first iOS)

```
POST /sync
{
  "since": "2026-07-19T18:00:00Z",
  "mutations": [
    { "key": "uuid-1", "op": "complete", "instanceId": "ti_a",
      "at": "2026-07-20T07:31:00Z" },
    { "key": "uuid-2", "op": "redeem", "rewardId": "rw_b", "at": "…" }
  ]
}
→
{
  "results": [ { "key": "uuid-1", "status": "applied", "points": 15 },
               { "key": "uuid-2", "status": "rejected",
                 "code": "INSUFFICIENT_POINTS" } ],
  "changes": { "instances": [...], "ledger": [...], "rewards": [...] },
  "serverTime": "2026-07-20T09:00:00Z"
}
```
Regels: mutaties worden in volgorde toegepast in de Family-DO; `key` = idempotency; conflictregel "afgevinkt wint"; afgewezen mutaties toont de app vriendelijk ("je punten waren al uitgegeven op je andere apparaat"). Losse endpoints (§3.5–3.8) gebruiken online precies dezelfde interne handlers.

### 3.12 Account (AVG)

| Methode & pad | Rol | Beschrijving |
|---|---|---|
| `GET /account/export` | parent | Machineleesbare export (JSON, zip met foto's) — art. 20 AVG. Async: job → downloadlink per mail/push. |
| `DELETE /account` | parent | Heel gezin: 7 d soft delete → cascade D1 + R2-prefix + KV. Bevestiging vereist (wachtwoord her-invoer). |

### 3.13 WebSocket
`GET /ws?token=<short-lived ws-token>` → upgrade naar Family-DO. Server-events: `instance.updated`, `points.changed`, `redemption.created`, `badge.earned`. Alleen ouder-dashboards hoeven te verbinden; de kind-app werkt prima met pull + push-notificaties.

---

## 4. Rate limits (per IP tenzij anders vermeld)

| Endpoint | Limiet |
|---|---|
| `/auth/family-code`, `/auth/child-session` | 10/min per IP, 5 pincode-fouten per kind → lock |
| `/auth/login`, `/auth/register` | 5/min + Turnstile |
| `/photos/upload-intent` | 20/dag per kind |
| Overig (geauthenticeerd) | 120/min per user |

---

## 5. Rollenmatrix (samenvatting)

| Actie | Kind | Ouder (approve_only) | Ouder (full) |
|---|---|---|---|
| Eigen taken zien/afvinken | ✅ | ✅ (zien) | ✅ |
| Foto uploaden bij taak | ✅ | — | — |
| Goedkeuren/redo | — | ✅ | ✅ |
| Taken/beloningen beheren | — | — | ✅ |
| Beloning kopen | ✅ | — | — |
| Inlossing afhandelen | — | ✅ | ✅ |
| Gezinsinstellingen, leden, verwijdering | — | — | ✅ |
| Ledger inzien | eigen | alle | alle |

---

## 6. Codestructuur `apps/api`

```
apps/api/
├── wrangler.toml            # bindings: DB(D1), PHOTOS(R2), KV, FAMILY_DO, QUEUE
├── migrations/              # 0001_init.sql, 0002_rewards.sql, …
└── src/
    ├── index.ts             # Hono-app, route-mounting, error handler
    ├── middleware/
    │   ├── auth.ts          # JWT-verificatie → ctx {userId, familyId, role}
    │   ├── authz.ts         # rol-guards: requireParent(), requireSelfChild()
    │   ├── idempotency.ts   # KV-check op Idempotency-Key
    │   └── ratelimit.ts
    ├── routes/              # dunne handlers: validatie (Zod) → service
    │   ├── auth.ts  families.ts  members.ts  tasks.ts
    │   ├── instances.ts  photos.ts  points.ts  rewards.ts
    │   ├── devices.ts  sync.ts  account.ts
    ├── services/            # businesslogica (unit-testbaar, geen Hono-imports)
    │   ├── taskEngine.ts    # recurrence → instances, roulatie
    │   ├── pointsEngine.ts  # ledger, dag/weekbonus, streaks, badges
    │   ├── photoService.ts  # presign, confirm, signed GET
    │   └── notifier.ts      # APNs-payloads + positieve copy-catalogus
    ├── do/
    │   └── FamilyRoom.ts    # Durable Object: WS-broadcast + ledger-serialisatie
    ├── repo/                # ENIGE plek met SQL; elke functie eist familyId
    ├── jobs/
    │   ├── cron.ts          # dagelijkse instance-generatie, notificatie-scheduler
    │   └── photoConsumer.ts # Queue: EXIF-strip, thumbnail
    └── shared/ → packages/shared (Zod-schemas, foutcodes, types)
```

Architectuurregel die de authz-testsuite afdwingt: **routes praten nooit rechtstreeks met D1** — alleen via `repo/`, en elke repo-functie heeft `familyId` als verplicht eerste argument.

---

## 7. Volgende stap

Dit contract omzetten in code: Zod-schemas in `packages/shared`, `0001_init.sql`, en de eerste drie routes werkend (auth → families → tasks) met de authz-testsuite als fundament.
