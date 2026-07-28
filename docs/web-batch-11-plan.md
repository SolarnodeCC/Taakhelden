# Web dashboard — Batch 11 plan

Planning voor de elfde bouwslag van het ouder-dashboard (`apps/web`). Dit
document is de scope- en aanpakafspraak; de implementatie volgt in een aparte PR
**nadat Batch 10 is gemerged** (Batch 11 bouwt voort op het complete
gezinsbeheer-dashboard + bestaande Vandaag/Goedkeuren-pagina's).

## Waar we staan (batch 1–10)

| Batch | Inhoud | Status |
| --- | --- | --- |
| 1–3 | i18n, auth/BFF, app-shell + nav | Done |
| 4 | **Vandaag** + **Goedkeuren** | Done |
| 5 | **Taken** + **Winkel** (basis-CRUD) | Done |
| 6 | **Inzichten** | Stub — Fase 2 |
| 7 | **Registratie** + **Gezin/kinderen** + gezinscode/QR | Done |
| 8 | **Co-ouder** + **gezinsinstellingen** + route-guards | Done |
| 9 | **Taken-verdieping** (templates, roulatie, weekoverzicht) | Done |
| 10 | **Notificaties** + **punten/ledger** + **privacy/AVG** | Done |
| **11** | **Realtime** (FamilyRoom WebSocket-client) | Dit plan |

Na Batch 10 is het ouder-dashboard functioneel compleet voor setup, privacy en
dagelijks beheer. Wat product §3.1 / architectuurdoc §3 belooft maar de web-UI
nog mist:

- **Realtime updates** op Vandaag en Goedkeuren wanneer een kind een taak afvinkt
  of indient — zonder handmatig verversen of tight-polling.

De API is hiervoor **volledig klaar**:

- `POST /ws/token` (ouder, geauthenticeerd) → kortlevend ws-JWT (60 s).
- `GET /ws?token=…` → WebSocket-upgrade naar de FamilyRoom-DO van het gezin.
- Server-events: `instance.updated`, `points.changed`, `redemption.created`,
  `redemption.updated`, `badge.earned` (laatste twee deels buiten MVP-scope UI).
- Authz- en broadcast-tests bestaan (`apps/api/test/ws.test.ts`).

Geen Worker-migratie verwacht; eventueel kleine **shared**-uitbreiding (Zod voor
wire-format + `redemption.updated` in enum).

## Scope van batch 11 — realtime: **FamilyRoom WebSocket-client**

Batch 11 sluit het laatste grote UX-gat in de dagelijkse ouderlus: het dashboard
reageert live op kind-acties.

1. **Gedeelde WS-client** — één verbinding per ingelogde ouder-sessie in de
   dashboard-shell; reconnect met backoff; geen tight-polling.
2. **Vandaag** — bij relevante events de dagweergave verversen (statuskolommen +
   saldo).
3. **Goedkeuren** — nieuwe `submitted`-items verschijnen automatisch in de queue;
   goedkeuring door co-ouder op ander device verdwijnt uit de queue.

### Waarom realtime nu, en niet drag-drop / Inzichten

- **Productbelofte.** Productvoorstel §3.1: “Ouder-dashboard krijgt realtime
  updates zodat goedkeuren direct kan.” Architectuurdoc: DO broadcast bij
  afvinken.
- **API + DO zijn af.** Batch 10 bewust uitgesteld; nu is de enige ontbrekende
  laag de **web-client**.
- **Grote impact, beperkte scope.** Eén hook/provider + twee pagina's aanpassen;
  geen nieuw datamodel of instance-move-contract.
- **iOS-pariteit.** iOS-bouwvoorstel §6.3 beschrijft exact dit patroon (eerste
  echte WS-client); web implementeert hetzelfde contract.
- **Inzichten** blijft Fase 2 (Batch 6-stub).
- **Weekplanner drag-drop** vereist nieuw instance-move-API — bewust **Batch 12**
  (zie buiten scope).

### Afhankelijkheid

```
Batch 10 merged → Branch vanaf main → Batch 11 implementatie-PR
```

Zonder werkende BFF (`/api/v1/*`), `AppShell`, en de bestaande
`GET /instances/today`-flows op Vandaag/Goedkeuren is dit plan niet
implementeerbaar.

### Buiten scope (volgende batches)

- **Batch 12 — Weekplanner drag-drop**: instance verplaatsen (nieuw API-contract +
  Worker-repo).
- **Stretch (niet default)**: Winkel live bij `redemption.created` /
  `redemption.updated`; badge-toasts op Vandaag.
- **Fase 2 — Inzichten**: statistieken, streaks-dashboard, ouder-analytics.
- **Niet in deze batch**: WS-proxy via Next.js upgrade-handler (tenzij review
  BFF-only eist), kind-WS (privacyverbod), SIWA, marketing-landing, push op web.

## Wat we bouwen

### 1. Shared contract (kleine uitbreiding)

**Plaats**: `packages/shared/src/schemas/ws.ts`

- **`WsMessage`** — Zod-schema voor wire-format `{ event: WsServerEvent, data: … }`.
- **Event-payloads** (minimaal voor client-validatie):
  | Event | `data` (huidige DO-broadcast) |
  | --- | --- |
  | `instance.updated` | `{ instanceId, status, childId, photoStatus? }` |
  | `points.changed` | `{ childId, newBalance }` |
  | `redemption.created` | `{ redemptionId, rewardId, childId }` |
  | `redemption.updated` | `{ redemptionId, status, childId }` |
  | `badge.earned` | `{ childId, badge }` |
- Voeg **`redemption.updated`** toe aan `WsServerEvent` (DO broadcast dit al;
  enum en API-spec §3.13 alignen).
- Export via `@taakhelden/shared`; web contract-tests voor parse.

### 2. BFF: ws-token + connect-URL

**Probleem**: `apiClient` praat alleen same-origin met de BFF; de browser moet
wel naar de Worker upgraden (native WebSocket, geen `Authorization`-header).

**Voorstel (A)** — nieuwe route `POST /api/ws/connect` (server-only):

1. Leest ouder-sessie uit cookies (zelfde patroon als `/api/v1` proxy).
2. Roept Worker `POST /v1/ws/token` aan met bearer.
3. Retourneert `{ token, expiresIn, wsUrl }` waarbij `wsUrl` server-side wordt
   afgeleid van `API_BASE_URL` (`http→ws`, `https→wss`, pad `/v1/ws`).
4. **Geen** `NEXT_PUBLIC_*` nodig; deployment-URL blijft server-config.

**Alternatief (B)**: alleen bestaande `POST /api/v1/ws/token` proxy + aparte
`NEXT_PUBLIC_WS_BASE_URL` — minder voorkeur (extra env, URL-lek naar client-config).

### 3. `useFamilyRealtime` hook + provider

**Plaats**: `apps/web/lib/realtime/` (nieuw)

**Verantwoordelijkheden**:

| Onderdeel | Gedrag |
| --- | --- |
| Verbinden | Bij mount in `AppShell`: `POST /api/ws/connect` → `new WebSocket(wsUrl + ?token=)` |
| Parse | Inkomende berichten via `WsMessage.safeParse`; ongeldige frames negeren |
| Reconnect | Bij `close` / `error`: exponential backoff **2 s → 4 s → 8 s** (max), nieuw token per poging |
| Refetch-signaal | Bij geldig event: `notifyListeners(event)` — geen businesslogica in de hook zelf |
| Cleanup | `close()` bij unmount / logout |
| Status | `connected` \| `connecting` \| `disconnected` voor optionele UI-indicator |

**Privacy / security**:

- Log nooit tokens, roepnamen of event-payloads met PII.
- Eén verbinding per tab; geen WS voor kind-rollen (API weigert al).
- `approve_only` en `full` mogen verbinden (beide zijn ouder).

**Provider**: `FamilyRealtimeProvider` om `AppShell` heen (of in `layout.tsx`
client-wrapper), zodat Vandaag/Goedkeuren (en optioneel Winkel) kunnen
subscriben zonder eigen socket.

### 4. Vandaag — live verversen

**Huidige staat**: eenmalige `GET /instances/today` in `useEffect`
(`VandaagClient.tsx`).

**Nieuwe gedrag**:

- Extract `loadToday()` (herbruikbare fetch + parse).
- Subscribe op realtime-context; bij `instance.updated` of `points.changed`:
  **debounced refetch** (voorstel **300 ms**) van `GET /instances/today`.
- Rationale: event-payload mist `title`/`icon`/`photoId` — refetch is
  eenvoudiger en consistenter dan partiële patch (iOS-bouwvoorstel §6.3:
  “bij reconnect REST-refetch”).
- Optionele micro-optimalisatie: bij alleen `points.changed` saldo in state
  patchen (`childId` + `newBalance`) **én** debounced refetch — alleen als het
  geen extra complexiteit geeft; default = refetch only.
- Bij reconnect (status → `connected`): direct één refetch.

**UX**: geen flitsende skeleton bij refetch als data al geladen is — toon
bestaande kaarten en vervang stilletjes (loading alleen op eerste load).

### 5. Goedkeuren — live queue

**Huidige staat**: eenmalige load + lokale `onResolve` na eigen approve/redo.

**Nieuwe gedrag**:

- Zelfde `loadToday()` / refetch-patroon.
- Na refetch: `toQueue(ParentTodayView)` opnieuw berekenen — nieuwe `submitted`
  items verschijnen; afgehandelde items verdwijnen ook als co-ouder op ander
  device acteerde.
- Eigen approve/redo blijft optimistisch (`onResolve`) + refetch als backup.
- Foto's (`PhotoThumb`) blijven lazy per `photoId`; geen wijziging nodig.

### 6. Verbindingsstatus (subtiel)

**Plaats**: `AppShell` header of footer — **niet** opdringerig.

- `connected`: niets tonen (default).
- `connecting` / `disconnected`: kleine muted tekst of icoon
  (`shell.realtime.connecting` / `shell.realtime.offline`) met tooltip “We
  proberen opnieuw verbinding te maken. Je kunt ook zelf verversen.”
- Geen schuldtaal; dashboard blijft bruikbaar via handmatige refresh (F5) en
  bestaande mutatie-flows.

### 7. Stretch: Winkel (alleen bij tijd over)

- Subscribe op `redemption.created` / `redemption.updated` → debounced refetch
  van `GET /redemptions?status=pending`.
- Niet in Definition of Done tenzij review expliciet meeneemt.

## Techniek & conventies

- **Datapatroon**: realtime-hook is puur transport; pagina's houden eigen state +
  bestaande `apiClient` + Zod-parse.
- **Geen tight-polling**: fallback is alleen handmatige refresh + reconnect
  backoff — nooit `< 2 s` interval polling.
- **Token-TTL (60 s)**: geldt alleen voor de **upgrade**; open verbinding blijft
  via DO hibernation. Bij reconnect altijd nieuw token via BFF.
- **i18n** (`nl` + `en`): `shell.realtime.*` (statuscopy).
- **Design**: ouder-register; statusindicator gebruikt `text-muted`, geen
  alarm-rood tenzij langdurig offline (> 30 s) — dan `text-warning` (token).
- **Tests**:
  - Shared: `WsMessage` parse per event-type.
  - Web: unit-test reconnect-backoff helper; mock `WebSocket` + listener
    debounce; optioneel integratietest met MSW (geen echte DO in web-CI).
  - API: geen wijziging vereist tenzij `redemption.updated` in spec wordt
    toegevoegd (documentatie-only PR ok).
- **Handmatige rooktest** (twee browsers of web + API curl):
  1. Ouder op Vandaag; kind vinkt taak af (API/seed) → kolom verschuift zonder
     refresh.
  2. Kind submitted met foto → item verschijnt op Goedkeuren binnen ~1 s.
  3. Co-ouder A keurt goed → queue van ouder B verliest item live.
  4. Worker herstart / netwerk uit → backoff + reconnect + refetch.
  5. Uitloggen → socket gesloten, geen errors in console.
  6. `approve_only` ouder: WS werkt; Vandaag/Goedkeuren updaten live.
  7. Locale EN: statuscopy vertaald.

## Definition of done

- [ ] `WsMessage` + payloads in shared; `redemption.updated` in enum.
- [ ] BFF `POST /api/ws/connect` (of gekozen variant) levert token + `wsUrl`.
- [ ] `FamilyRealtimeProvider` in dashboard-shell; één WS per sessie.
- [ ] Reconnect backoff 2/4/8 s; refetch bij reconnect en na events.
- [ ] Vandaag verversen op `instance.updated` / `points.changed`.
- [ ] Goedkeuren-queue verversen op `instance.updated` (submitted/approved/redo).
- [ ] Subtiele verbindingsstatus; geen PII/tokens in logs.
- [ ] nl + en strings compleet.
- [ ] `typecheck` + lint + tests groen; CI groen.
- [ ] Batch 10 is basis (gemerged).

## Acceptatiecriteria (PO-vriendelijk)

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | Ouder op Vandaag; kind vinkt taak af | Taak verschuift naar “klaar” / “wacht op goedkeuring” zonder handmatig verversen |
| 2 | Kind dient taak met foto in | Item verschijnt op Goedkeuren binnen seconden |
| 3 | Twee ouders op Goedkeuren; één keurt goed | Queue van de ander verliest het item |
| 4 | Saldo op Vandaag na goedkeuring | Punten op kindkaart kloppen na event |
| 5 | Kort netwerkverlies | Automatische reconnect; data klopt na herstel |
| 6 | Lang offline (> 30 s) | Rustige offline-indicator; handmatig verversen werkt nog |
| 7 | Uitloggen | Geen hangende WS; schone login opnieuw |
| 8 | `approve_only` ouder | Realtime werkt op Vandaag/Goedkeuren |
| 9 | Locale EN | Statuscopy in het Engels |

## Open vragen voor review

1. **BFF vs. public WS-URL**:
   - **A (voorstel):** `POST /api/ws/connect` retourneert `{ token, wsUrl }`
     server-afgeleid — geen extra client env.
   - **B:** `NEXT_PUBLIC_WS_BASE_URL` + bestaande `/api/v1/ws/token` proxy.
2. **Update-strategie**:
   - **A (voorstel):** debounced volledige refetch van `/instances/today` bij
     relevante events — simpel en consistent.
   - **B:** partiële state-patch op `points.changed` + refetch alleen bij
     `instance.updated`.
3. **Winkel meenemen?**
   - **A (voorstel):** nee — focus Vandaag/Goedkeuren; Winkel is stretch.
   - **B:** ja — `redemption.*` events hooken in dezelfde PR.
4. **Badge-toasts**: `badge.earned` visueel tonen op web?
   - **A (voorstel):** nee — kind-UX; web toont badges niet in MVP.
   - **B:** subtiele toast op Vandaag (extra copy + design).
5. **Shared/API sync**: `redemption.updated` en exacte payload-vormen in
   API-spec §3.13 bijwerken in dezelfde PR als shared?

## Agents / skills bij implementatie

| Onderdeel | Agent / skill |
| --- | --- |
| WS-hook, provider, Vandaag/Goedkeuren integratie | `@taakhelden-web` |
| BFF `/api/ws/connect` | `@taakhelden-web` |
| Shared `WsMessage` + enum-alignment | `@taakhelden-backend` (klein) |
| Reconnect/backoff + privacy (geen kind-WS) | `@taakhelden-architect` |
| nl/en catalogs | `@taakhelden-i18n` |
| Statusindicator tokens | `design-system` skill → `/design-check` |
| Geen tight-poll; geen PII in logs | `@architecture-reviewer` |
| Unit-tests hook + shared parse | `@taakhelden-tester` |
| WS authz review (ouder-only) | `@taakhelden-security` |
| E2E twee-sessie scenario (optioneel) | `@taakhelden-e2e` |

## Samenvatting

Batch 11 maakt de dagelijkse ouderlus **live**: één FamilyRoom WebSocket per
dashboard-sessie, reconnect met backoff, en automatische verversing van Vandaag
en Goedkeuren wanneer kinderen taken afvinken of indienen. De API en DO bestaan
al; het werk zit in BFF-connect, een gedeelde realtime-hook, en debounced refetch
op bestaande endpoints. Weekplanner drag-drop en Inzichten blijven bewust later.
