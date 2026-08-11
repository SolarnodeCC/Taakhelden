# TaakHelden — API-specificatie (v1)
*Cloudflare Worker (Hono + TypeScript), REST/JSON. Contract gedefinieerd in Zod (`packages/shared`), daaruit OpenAPI → Swift-modellen.*

---

## 1. Uitgangspunten

- **Base URL**: `https://api.taakhelden.nl/v1`
- **Auth**: `Authorization: Bearer <JWT>` op alles behalve `/auth/*` en `/health`.
- **JWT-claims**: `sub` (user_id), `fam` (family_id), `role` (`parent` | `child`), `iat`, `exp`. Kind- en ouder-tokens: 1 u access + 30 d refresh.
- **Idempotency-Key**: gecachet per `(gebruiker, sleutel, operatie)`. Een echte retry (zelfde endpoint én payload) geeft de eerste response terug met `Idempotent-Replay: true`. Dezelfde sleutel voor een andere actie geeft `409 IDEMPOTENCY_KEY_REUSED` — hergebruik is een clientfout, geen replay.
- **Rate limiting**: publieke routes zijn begrensd per aanroeper (IP) én per doelwit (account/gezinscode); geauthenticeerde routes hebben een basislimiet van 300 req/min per gebruiker. Overschrijding geeft `429 RATE_LIMITED`.
- **CSRF**: state-wijzigende BFF-calls worden geweigerd (`403`) als de `Origin`-header niet de eigen origin is.
- **Intrekking**: `iat` wordt vergeleken met een revocation epoch per gebruiker. Kind verwijderen, sessies intrekken, uitloggen en account verwijderen maken lopende access-tokens per direct ongeldig (`401`), niet pas bij `exp`.
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
/tasks/proposals taakvragen van tieners (WS-PROPOSAL): indienen, goedkeuren, afwijzen
/instances     dagelijkse taak-instanties: afvinken, goedkeuren
/photos        presigned upload + bevestiging
/points        saldo, ledger, bonusstatus
/rewards       beloningswinkel + inlossingen
/badges        verdiende badges
/devices       pushtoken-registratie, notificatie-instellingen
/sync          batch-sync voor offline-first clients (iOS + Android)
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
| `POST /auth/refresh` | — | Refresh token → nieuw access token (rotatie: oude refresh vervalt). **Rate-limit: 30/min/IP** (WS-TRUST-API). |
| `POST /auth/family-code` | — | Stap 1 kind-login: gezinscode (6 tekens) → lijst kindprofielen `{id, roepnaam, avatar}` van dat gezin. Geen auth, wel zwaar rate-limited. |
| `POST /auth/child-session` | — | Stap 2: `{familyCode, childId, pincode}` → kind-JWT (1 u). 5 foutpogingen → lock + pushmelding naar ouders; de lockduur verdubbelt per volgende ronde van 5 (15 min → max 4 u). |
| `POST /auth/child-session/refresh` | — | Kind-refresh token → nieuw kind-JWT + nieuw device-refresh. **Rate-limit: 30/min/IP** (WS-TRUST-API). |
| `POST /auth/logout` | beide | Refresh token intrekken. |

### 3.2 Families

| Methode & pad | Rol | Beschrijving |
|---|---|---|
| `GET /families/me` | beide | Gezin + instellingen. Kind krijgt een uitgeklede weergave (geen uitnodigingscode, geen leden-e-mails). |
| `PATCH /families/me` | parent | Naam, `timezone`, `quietHours` (bedtijd), `weekBonusThreshold` (default 0.8), `dayBonusPoints`, `weekBonusPoints`, `vacationMode`. |
| `POST /families/me/invite-code` | parent | (Her)genereer gezinscode; oude vervalt direct. |
| `POST /families/me/parents` | parent (`full`) | Tweede ouder/verzorger uitnodigen per e-mail; `permissions: "full" \| "approve_only"`. Response: `{ userId, email, permissions, status: "invited" }` — **géén `inviteToken`** (WS-TRUST-API Option A, P1-locked). |
| `GET /families/me/invites/:userId/link` | parent (`full`) | Geeft een kopieerbare uitnodigingslink (7 d geldig) terug voor de clipboard-fallback: `{ copyableUrl, expiresAt }`. Minst een nieuw token per aanroep. **Rate-limit: 10/min/IP.** (WS-TRUST-API) |

### 3.3 Members

| Methode & pad | Rol | Beschrijving |
|---|---|---|
| `GET /members` | beide | Alle gezinsleden (kind ziet roepnamen + avatars, geen e-mails/geboortejaren van anderen). |
| `POST /members/children` | parent | Kindprofiel: `{roepnaam, geboortejaar, avatarId?, pincode}` → server leidt `ageMode` af (`young` 4-7 / `mid` 8-12 / `teen` 13+). Legt oudertoestemming vast (timestamp + parent_id) — AVG art. 8. |
| `PATCH /members/{id}` | parent (kind: alleen eigen avatar) | Profiel wijzigen. Kind mag alleen `avatarId` van zichzelf wijzigen. |
| `POST /members/{id}/photo` | parent | Profielfoto via presigned-flow (§3.6). |
| `POST /members/{id}/pincode` | parent | Pincode resetten. |
| `DELETE /members/{id}` | parent | Kindprofiel verwijderen (soft delete 7 d, daarna cascade — zie /account). |
| `GET /members/{childId}/pause` | parent / kind-zelf | Actieve en toekomstige pauzes voor dit kind. Response: `{ pauses: ChildPause[] }`. |
| `PUT /members/{childId}/pause` | parent (`full`) | Rustschild instellen: `{ startsOn, endsOn?, reason? }`. Stopt instance-generatie en streak-gaten voor dit kind in het opgegeven bereik. **Geen ledger-effect.** `Idempotency-Key` aanbevolen (niet verplicht). |
| `DELETE /members/{childId}/pause/{pauseId}` | parent (`full`) | Pauze beëindigen (cleared_at zetten). 404 als al beëindigd. |

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

#### 3.4a Taakvragen — Taakvraag (WS-PROPOSAL)

Een tiener stelt een taak voor; een ouder maakt er een echte taak van of wijst hem vriendelijk af. **Een taakvraag raakt het ledger nooit** — punten stromen pas via de normale taak → afvinken → goedkeuren-route, nadat de ouder de vraag heeft goedgekeurd. Geen FamilyRoom-DO in het pad.

| Methode & pad | Rol | Beschrijving |
|---|---|---|
| `POST /tasks/proposals` | child (tienerregister) | Taakvraag indienen: `{title, category?, icon?, suggestedPoints, note?}`. **`Idempotency-Key` verplicht.** Levert geen punten en geen taak op. 403 als het kind niet in het tienerregister zit. |
| `GET /tasks/proposals?status=` | beide | Ouder ziet alle taakvragen van het gezin, kind alleen zijn eigen. Optioneel filter `status=pending\|approved\|declined`. Response: `{ proposals: TaskProposal[] }`. `reviewFlag` (zie hieronder) staat er alleen in voor `role=parent`. |
| `POST /tasks/proposals/{id}/approve` | parent (`full`) | `{points, approvalRequired?, assignees?}` → maakt een echte taak via de gewone `createTask`-route en koppelt `createdTaskId`. De ouder bepaalt de punten; die mogen afwijken van `suggestedPoints`. Lege `assignees` = alleen de indiener. **`Idempotency-Key` verplicht.** **Geen ledger-boeking.** Response: `{ proposal, taskId }`. |
| `POST /tasks/proposals/{id}/decline` | parent (`full`) | `{note}`: verplichte, vriendelijke toelichting; status wordt `declined`. **`Idempotency-Key` verplicht.** Geen puntenaftrek — nooit een negatieve mechaniek. |

**Leeftijdsgrens (serverside).** Indienen mag alleen vanuit het tienerregister: `users.age_mode = 'teen'` **of** een `birth_year` waaruit leeftijd ≥ 13 volgt. Die tweede voorwaarde vangt op dat `age_mode` bij het aanmaken van het profiel wordt afgeleid en daarna niet meebeweegt met de leeftijd. iOS toont de affordance al alleen in teen mode; de servercheck is de tweede grendel.

**Idempotentie.** De KV-middleware dedupt op (user, `Idempotency-Key`) en geeft de eerdere response terug. Daarnaast is de beslissing zelf een atomaire claim (`UPDATE … WHERE status = 'pending'`): een tweede goedkeuring met een *nieuwe* key krijgt `409 INVALID_STATUS` en er ontstaat nooit een tweede taak.

**Veiligheidsvlag (WS-AI-GUARD, ADR-0006).** Bij het aanmaken screent de server `title` + `note`
deterministisch (`services/proposalScreen.ts`, geen model-call) op mogelijke veiligheidszorgen.
Een match blokkeert de taakvraag **niet** — hij wordt altijd aangemaakt — maar zet `review_flag`
in D1. Dat veld komt als `reviewFlag` alleen terug op ouder-facing responses
(`GET /tasks/proposals` met `role=parent`, en de `approve`/`decline`-responses); het **ontbreekt
volledig** — niet `null` — op elke kind-facing response, inclusief de `201` van de eigen indiener.

**Taakvraag-schema (`TaskProposal`):**
```json
{
  "id": "prp_…",
  "childId": "ch_noor",
  "title": "Auto wassen",
  "category": "household",            // household | homework | selfcare | custom
  "icon": "star",
  "suggestedPoints": 25,              // suggestie van het kind, 1–100
  "note": "Ik wil sparen voor de bioscoop",
  "status": "pending",                // pending | approved | declined
  "decisionNote": null,               // vriendelijke toelichting van de ouder bij afwijzen
  "decidedAt": null,
  "createdTaskId": null,              // gevuld na goedkeuren
  "createdAt": "2026-08-01T09:12:33.412Z",
  "reviewFlag": null                  // ouder-only; ontbreekt (niet null) op kind-facing responses
}
```

### 3.5 Instances (de kern van de app)

| Methode & pad | Rol | Beschrijving |
|---|---|---|
| `GET /instances/today` | beide | Kind: eigen taken van vandaag + puntenstatus + dagbonus-voortgang. Ouder: alle kinderen gegroepeerd. |
| `GET /instances?childId=&from=&to=` | parent | Historie (paginated). |
| `GET /instances/pending-approval` | parent | Alle instances met status `submitted` over alle datums, oudste eerst. Oplossing voor de overnight-gap in de goedkeuringsrij (WS-TRUST-WEB/API). Response: `{ items: PendingApprovalItem[] }`. |
| `POST /instances/{id}/complete` | child (eigen) / parent | Afvinken. `Idempotency-Key` verplicht. Response: verdiende punten, of dag/weekbonus getriggerd is, evt. nieuwe badge → app toont confetti in één roundtrip. |
| `POST /instances/{id}/photo` | child (eigen) | Foto-bonus koppelen: `{photoId}` (na presigned upload). Status blijft `submitted` tot verwerking + evt. goedkeuring. |
| `POST /instances/{id}/approve` | parent | Goedkeuren → punten definitief in ledger, push naar kind. |
| `POST /instances/{id}/redo` | parent | `{note}`: vriendelijke toelichting, terug naar `open_redo`. **Geen puntenaftrek.** |
| `POST /instances/{id}/undo` | child (eigen, < 5 min) | Oeps-knop: afvinken ongedaan maken zolang niet goedgekeurd. |
| `POST /instances/{id}/move` | parent (`full`) | Instance verplaatsen naar `{ date, childId }`. Alleen `open` / `open_redo`. `Idempotency-Key` verplicht. Geen ledger-wijziging. 409 `INSTANCE_SLOT_TAKEN` bij bezette doelslot. |

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

**Streak (`streakDays`)** = aaneengesloten dagen met dagbonus, t/m vandaag of gisteren (een nog open dag vandaag breekt niets). Streakbescherming, conform de productbelofte: **per ISO-kalenderweek (ma t/m zo) mag één dag zonder dagbonus overgeslagen worden** zonder dat de streak breekt; een tweede gemiste dag in diezelfde week stopt de streak. Een overgeslagen dag telt zelf niet mee als streakdag (hij is vergeven, niet verdiend), en "vandaag nog niet verdiend" kost géén weekvergeving. **Rustschild-pauze (WS-PAUSE):** een gepauzeerde dag is transparant — telt noch als verdiend, noch als gemiste dag, en verbruikt het weekvergevingsbudget niet. Vakantiemodus staat hier los van.

### 3.14 Inzichten / Gesprekskaart (WS-INSIGHTS)

**Endpoint:** `GET /families/me/insights?range=week&weekOf=YYYY-MM-DD&childId=<optioneel>`
- Rol: parent only. Read-only; geen DO, geen ledger-write.
- `range`: alleen `week` ondersteund.
- `weekOf`: ISO-datum van de maandag van de gewenste week (default: huidige week).
- `childId`: optioneel; filtert op één kind.

**Response (WeeklyInsightsResponse):**
```json
{
  "weekOf": "2026-07-27",
  "range": "week",
  "children": [
    {
      "childId": "ch_noor",
      "displayName": "Noor",
      "earned": 90,
      "spent": 15,
      "net": 75,
      "tasksApproved": 6,
      "tasksTotal": 7,
      "completionRate": 0.857,
      "streakDays": 5,
      "slippingTasks": [
        { "taskId": "tsk_abc", "title": "Huiswerk", "icon": "📚", "missed": 2 }
      ]
    }
  ]
}
```
- `earned` = som van positieve ledger-bedragen die week (excl. `redemption_cancel`).
- `spent` = magnitude van `redemption`-bedragen die week.
- `net = earned − spent` (nooit als schuld geframed).
- `slippingTasks` = top-5 taken met de meeste `open`/`open_redo`-instances die week; kinderen worden nooit onderling gerangschikt.
- Endpoint is parent-only (403 voor kindtokens) en levert nooit kind-PII buiten `displayName`.

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
| `POST /devices` | beide | `{apnsToken, platform, userId}` — token per profiel (gedeeld toestel: token kan aan meerdere profielen hangen). `platform` is `ios` \| `android` en bepaalt de gateway: APNs of FCM. Het veld heet historisch `apnsToken` maar draagt ook het FCM-registratietoken. |
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

**Delta (`changes`)**:
- `changes.instances` is een array van volledige `InstanceView`-objecten, inclusief het nieuwe veld **`updatedAt`** (ISO-8601 UTC, servertijd van de laatste wijziging).
- **Mét `since`**: alle instances van de aanroeper met `updated_at > since` (max 500, oudste wijziging eerst). Kind = eigen instances, ouder = alle kinderen van het gezin.
- **Zonder `since`** (eerste sync na installatie): de volledige dag van vandaag, zoals `GET /instances/today`.
- De client bewaart `serverTime` uit de response en stuurt die als `since` in de volgende ronde. Komen er precies 500 instances terug (mogelijk afgekapt na een lange offline-periode), gebruik dan de `updatedAt` van de laatste instance als `since` en sync direct nog een ronde.
- `updatedAt` is optioneel in het contract, zodat clients van vóór deze wijziging niet breken.

### 3.12 Account (AVG)

| Methode & pad | Rol | Beschrijving |
|---|---|---|
| `POST /account/export` | parent | Start een asynchrone export-job (art. 20). **`Idempotency-Key` verplicht.** **Rate-limit: 3/uur/IP** (WS-TRUST-API). Als er al een `pending` export-job bestaat voor dit gezin, wordt die teruggegeven i.p.v. een nieuwe job aan te maken. Response: `{ exportId, status: "pending" }`. |
| `GET /account/export/:id` | parent | Status van een export-job; zodra klaar een kortlevende HMAC-gesigneerde downloadlink. |
| `GET /account/export/:id/file` | — | Publiek, HMAC-gesigneerd: download het ZIP-bestand. |
| `DELETE /account` | parent (`full`) | Heel gezin: 7 d soft delete → cascade D1 + R2-prefix + KV. Bevestiging vereist (wachtwoord her-invoer). |

### 3.13 WebSocket
`GET /ws` → upgrade naar Family-DO. Het kortlevende ws-token gaat mee als subprotocol: `Sec-WebSocket-Protocol: wispel.v1, auth.<token>` (browser: `new WebSocket(url, wsAuthSubprotocols(token))`). De server echoot `wispel.v1` terug. `?token=<ws-token>` werkt nog voor de iOS-client, maar is deprecated — query strings belanden in browserhistorie, `Referer`-headers en proxy-logs. Server-events: `instance.updated`, `points.changed`, `redemption.created`, `redemption.updated`, `badge.earned`. Alleen ouder-dashboards hoeven te verbinden; de kind-app werkt prima met pull + push-notificaties.

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
| Taakvraag indienen | ✅ (alleen teen) | — | — |
| Taakvraag goedkeuren/afwijzen | — | — | ✅ |
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
    │   └── notifier.ts      # APNs- en FCM-payloads + positieve copy-catalogus
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
