# TaakHelden iOS — bouwvoorstel

*Senior architectuur- + UI-voorstel. Aansluiting op `apps/api`, `apps/web` en `Design System/`. Status: voorstel ter beslissing — geen implementatie.*

**Kopconclusie:** de API is ver genoeg om vandaag te beginnen; de iOS-app is dat niet. Het gat zit niet in “welke SwiftUI-views”, maar in **contractfundament** (OpenAPI/response-schemas, kind-sessie-verlenging, APNs-sandbox) en **productkeuzes** (één app of twee, wie levert ouder-onboarding). Zonder die beslissingen bouwen we drift en herwerk.

---

## 1. Uitgangspunt

| Oppervlak | Rol | Status nu |
|---|---|---|
| **iOS (SwiftUI)** | Primair kind-apparaat + ouder-onboarding/goedkeuren onderweg | Alleen `apps/ios/README.md` — geen Xcode-project in de repo |
| **Web (Next.js)** | Volwaardig ouder-dashboard | Vandaag / Goedkeuren / Taken / Winkel werken; Inzichten = stub; geen kindbeheer / gezinscode / SIWA |
| **API (Worker + D1 + FamilyRoom DO)** | Enige bron van waarheid | Contract grotendeels geïmplementeerd: auth, ledger, sync, foto’s, APNs, WS |
| **Design System** | Visuele richting kid/teen/dashboard | UI-kits voor Mijn Dag / Winkel / Mijn Held + TeenMode; kid/teen-palet is *inferred*, geen finale branding |

**Kernprincipe (ononderhandelbaar, zelfde als web/API):**

1. Routes/client praten alleen via het gedeelde contract (`packages/shared` + API-spec).
2. Mutaties zijn idempotent (`Idempotency-Key` stabiel per intent).
3. Punten = ledger-som van de server — nooit lokaal “vertrouwd” saldo.
4. Geen negatieve mechanieken in UI of copy.
5. Geen kind-PII in logs/analytics/crash reports.
6. Requests/responses valideren tegen gedeelde schemas.

---

## 2. Kritische diagnose (wat blokkeert écht)

### 2.1 Contract — belofte vs. werkelijkheid

Architectuurdoc en iOS-README beloven: *Zod → OpenAPI → Swift OpenAPI Generator → nooit handmatige JSON*. Die pijplijn bestaat **niet**. Request-schemas in `packages/shared` zijn sterk; response-schemas zijn fragmentarisch. Zonder fase 0 schrijft iOS ~25 modellen met de hand en drift het contract bij elke backend-wijziging.

**Oplossing:** response-schemas eerst in shared, OpenAPI genereren, CI faalt bij drift. Pas daarna Swift codegen.

### 2.2 Rolafhankelijke JSON op één pad

`/instances/today`, `/points/balance`, `/rewards`, `/families/me`, `/members` geven **andere JSON** afhankelijk van JWT-rol. Voor gegenereerde clients is dat giftig (één operatie = één responstype).

**Oplossing (aanbevolen):** discriminator `viewer: "child" | "parent"` in die responses, gemodelleerd als Swift enum met associated values. Alternatief (aparte paden) is REST-netter maar raakt web + spec harder.

### 2.3 Kind-sessie: 24 u zonder refresh

`POST /auth/child-session` geeft een kind-JWT van 24 uur **zonder** refresh. Gevolg: elke dag opnieuw gezinscode + PIN — onwerkbaar voor een 5-jarige, en de gezinscode zit bij de ouder.

**Oplossing:** splits **device pairing** (eenmalig via gezinscode) van **profiel-unlock** (dagelijks Face ID / PIN lokaal). Server geeft een device-gebonden kind-refresh-token; ouder kan toestel intrekken. Zie §5.2.

### 2.4 Onboarding-gat

`POST /members/children` bestaat, maar **geen UI** (web noch iOS) maakt kindprofielen of toont de gezinscode. De kind-loginflow is end-to-end onbereikbaar. App Store-review eist een werkende demo-flow.

**Oplossing:** iOS levert ouder-onboarding in MVP (SIWA hoort daar; koppeling gebeurt fysiek naast het kindtoestel). Web volgt voor dashboard-beheer.

### 2.5 APNs niet testbaar

Notifier hardcodet productie-host; sandbox-tokens van debug/TestFlight falen stil. Push is niet te valideren tot dit gefixt is.

**Oplossing:** hostkeuze per omgeving + `APPLE_BUNDLE_ID` los van SIWA-audience (nu één `APPLE_CLIENT_ID` voor beide).

### 2.6 Governance-tegenstrijdigheid

`docs/…architectuur.md` zet het Xcode-project in `apps/ios/`; `.claude/skills/ios-dev.md` zegt “buiten de repo”. Zonder bron in de monorepo geen CODEOWNERS, geen contract-review, geen CI op PRs.

**Oplossing:** Xcode-project **in** `apps/ios/` (spm/xcodeproj of XcodeGen). Buiten-repo was pragmatisch; het is geen houdbaar model voor deze codebase.

---

## 3. Productkeuzes (eerst beslissen)

| # | Vraag | Aanbeveling | Waarom |
|---|---|---|---|
| **P1** | Één app of twee App Store-listings? | **Één familie-app, twee modi** (kind + ouder) | Past bij gedeelde iPad, SIWA-onboarding, parental gate = ouder-login. Productvoorstel §6.10 prefereert “familie-app met kindermodus” boven formele Kids Category. |
| **P2** | Wie levert ouder-onboarding? | **iOS in MVP** (web parallel later) | SIWA + fysieke koppeling; web mist kindbeheer sowieso. |
| **P3** | Turnstile op native registratie? | **SIWA primair**; e-mail/wachtwoord fallback via web of later | Turnstile is web-native; SIWA heeft geen Turnstile nodig op de API. |
| **P4** | Min. iOS-versie | **iOS 17** | `@Observable`, betere SwiftData, `ContentUnavailableView`. README zei 16 — herzien. |
| **P5** | Young-modus (4–7) in MVP? | **Nee — mid + teen eerst**; young in v1 | Geen UI-kit voor young; product vraagt voorleesknop + bijna-tekstloos. Ontwerp eerst. |
| **P6** | Repo-locatie Xcode | **In `apps/ios/`** | Contract-governance + `ios.yml`. |

Deze zes moeten als ADR’s of PO-besluiten vastliggen vóór sprint 1 van SwiftUI-features.

---

## 4. Doelarchitectuur (aansluiting op website + API)

```
┌─────────────────────────────┐     ┌──────────────────────────┐
│  iOS TaakHelden (SwiftUI)   │     │  Web ouder-dashboard     │
│  Kind-modus · Ouder-modus   │     │  Next.js BFF → API       │
└──────────────┬──────────────┘     └────────────┬─────────────┘
               │ REST + (ouder) WS                │ REST (BFF)
               │ Idempotency-Key · JWT            │
               └────────────────┬─────────────────┘
                                ▼
                    ┌───────────────────────┐
                    │  apps/api  /v1        │
                    │  Hono · D1 · R2 · DO  │
                    │  FamilyRoom ledger    │
                    └───────────────────────┘
                                ▲
                    packages/shared (Zod)
                         │
                    OpenAPI (gegenereerd)
                         │
                    Swift OpenAPI Generator
```

**Verantwoordelijkheidsverdeling (geen overlap, geen gaten):**

| Flow | iOS | Web |
|---|---|---|
| Kind dagelijks gebruik (afvinken, winkel, held) | ✅ primair | ❌ (optioneel read-only later) |
| Kind-apparaat koppelen (QR/code + PIN) | ✅ | toont code |
| Ouder-onboarding / SIWA | ✅ MVP | e-mail/wachtwoord nu; SIWA later |
| Taken/beloningen beheren | licht (onderweg) in v1 | ✅ primair |
| Goedkeuren met foto | ✅ (push → queue) | ✅ |
| Inzichten | later | stub → v1 web |
| Realtime FamilyRoom WS | ✅ ouder-modus | nog niet; iOS is eerste echte client |
| Offline afvinken | ✅ verplicht | n.v.t. (online dashboard) |

Web blijft het rustige commandocentrum. iOS is het speelveld van het kind én de mobiele ouder-poort. Zelfde tokens, zelfde foutcodes, zelfde ledger — andere registers.

---

## 5. Auth, sessies, apparaten

### 5.1 Ouder

- **Primair:** Sign in with Apple → `POST /auth/apple`.
- **Fallback:** e-mail/wachtwoord (bestaande web-flow); op iOS niet forceren in MVP.
- Access 1 u + refresh 30 d met rotatie.
- Tokens in **Keychain**; één **seriële refresh-actor** achter alle 401’s (parallelle refresh = spontane logout).
- Accountverwijdering: API moet SIWA-herinvoer accepteren (nu faalt Apple-only delete op wachtwoordcheck) — App Store 5.1.1(v) + AVG art. 17.

### 5.2 Kind (voorgesteld model)

```
[Eerste keer]  Gezinscode → profielkiezer → PIN
               → child access JWT + device-bound refresh
               → Keychain (accessControl: userPresence)

[Dagelijks]    Face ID / Touch ID ontgrendelt Keychain
               → refresh access indien nodig
               → géén gezinscode meer

[Ouder]        “Dit toestel loskoppelen” trekt refresh in
```

Backend-werk (fase 0): migratie `child_device_sessions` (of uitbreiding `devices`), `POST /auth/child-session/refresh`, revoke vanuit ouderprofiel.

**Gedeelde iPad:** `POST /devices` ondersteunt al multi-profiel per APNs-token. iOS toont een profielkiezer; wisselen = lokale unlock van ander Keychain-item, geen “één user per app”-aanname.

### 5.3 Parental gate

In één binary: ouder-instellingen / SIWA / accountbeheer achter ouder-login. Kindmodus heeft geen pad naar web-links of aankopen zonder die poort.

---

## 6. Offline, sync, realtime, push

### 6.1 Offline-first (kind)

| Intent | Offline? | Gedrag |
|---|---|---|
| Taak afvinken | ✅ | Lokale queue + stabiele Idempotency-Key in SwiftData; `/sync` bij verbinding |
| Beloning inwisselen | ✅ | Idem; bij `INSUFFICIENT_POINTS` mutatie definitief droppen + vriendelijke copy |
| Spaardoel pinnen | ✅ (na contract-fix) | Nu ontbreekt `pin` als sync-mutatie |
| Foto-bonus | ⚠️ hybride | JPEG lokaal parkeren → online: intent → PUT → confirm → attach (URL-TTL 5 min) |
| Undo (5 min) | ⚠️ | Lokaal: queue-entry intrekken als nog niet gesynct; anders server-undo binnen window |

**Regels:**

- Idempotency-Key = UUID per *tik*, persistent, hergebruikt bij retry — **niet** zoals web (verse UUID per HTTP-call).
- Optimistische UI: vink + confetti direct; **puntengetal** komt uit server-response (`newBalance`). Kind mag nooit zien dat punten “weggaan” door sync-correctie — herstel stil of met positieve herformulering.
- `TASK_ALREADY_COMPLETED` (409) = succes voor de UI (“afgevinkt wint”).
- Saldo nooit lokaal sommeren.

### 6.2 Sync-contract verbeteren (fase 0/2)

Huidige `/sync` delta is dun: ledger sinds `since`, instances van *alleen vandaag*, volle rewards-lijst; geen tasks/members/badges/redemptions/tombstones. `task_instances` mist `updated_at`.

**MVP:** pull bij `scenePhase.active`, na eigen mutatie, + `BGAppRefreshTask`.  
**v1:** echte delta (`updated_at` + tombstones) + stille push → background `/sync`.

### 6.3 Realtime

FamilyRoom-WS is **ouder-only** (`POST /ws/token` → `requireParent`). Kind leest geen sibling-events — privacy-invariant. iOS ouder-modus = eerste echte WS-client (web gebruikt hem nog niet). Reconnect met backoff 2/4/8 s; bij reconnect REST-refetch; nooit tight-pollen.

### 6.4 Push

- Tokenregistratie via `POST /devices` (multi-profiel ok).
- Backend: quiet hours + max 2/dag/kind; copy via stijlgids §3.7.
- Nodig vóór nuttige deep links: `PushPayload` in shared (`type`, `refId`, `childId`) + `content-available` op approve/redo.
- APNs sandbox/productie splitsen (anders TestFlight dood).

**Foto-upload praktisch:** iOS exporteert altijd **JPEG ~2 MP** (geen HEIC naar de brittle EXIF-strip). Minder falen, snellere upload, past in 5-min TTL.

---

## 7. UI-architectuur (SwiftUI × Design System)

### 7.1 Registers = environment, geen dubbele schermen

Design System heeft `TeenModeScreen` als **kopie** van Mijn Dag. Dat niet nabouwen.

```
AgeMode (server: young | mid | teen)
  → Palette (KidPalette | TeenPalette | ParentPalette)
  → Typography (rounded vs sans)
  → Radius / shadow / ornament-density
```

Eén `TaskCard`, `RewardCard`, `PointsBadge`, … met geïnjecteerd palet. Young later: grotere targets + `AVSpeechSynthesizer`, zelfde componenten.

### 7.2 Schermen MVP (mid + teen)

| Tab | Bron UI-kit | API |
|---|---|---|
| **Mijn Dag** | `MijnDagScreen` | `GET /instances/today`, `POST …/complete`, undo, photo-flow, `GET /points/balance` |
| **Winkel** | `WinkelScreen` | `GET /rewards`, redeem, pin, eigen redemptions (kind-scope — contract-fix) |
| **Mijn Held** | `MijnHeldScreen` | badges, avatar, level uit `lifetimeEarned` (niet uit balance!) |
| **Onboarding** | — | SIWA / family-code / child-session / members/children |

Headerpatroon Mijn Dag: `AvatarBadge` + `PointsBadge` + `StreakBadge` — exact zoals de kit, gevoed door server.

### 7.3 Tokens → SwiftUI

| DS | SwiftUI |
|---|---|
| `tokens/colors.css` | Asset catalog + `Palette` protocol; raw hex alleen in token-laag |
| Fredoka (web-substituut) | **SF Rounded** (`Font.system(…, design: .rounded)`) — niet Fredoka bundelen |
| spacing 4…64 | `Spacing` enum |
| radius 6/10/16/24 | kid = xl, teen = 12, parent = default |
| `--shadow-kid` | warm coral shadow; kit gebruikt soms `shadow-sm` — **iOS volgt intended warm shadow** |
| Confetti CSS | Native `Canvas`/`TimelineView` of Lottie; respecteer Reduce Motion |
| Emoji-iconen | MVP ok; mapping `icon` string → SF Symbol + emoji-fallback in shared catalogus |

**Bewust niet overnemen:** `SidebarNav` (web-only). iOS = `TabView`.

### 7.4 Motion & toegankelijkheid (vanaf dag 1)

- Afvinken: check-animatie + haptic (success); milestone: confetti.
- Dynamic Type, VoiceOver op elke control (emoji krijgt label), ≥ 44 pt targets.
- Status nooit alleen op kleur (vorm + tekst: open / bijna / gelukt).
- Teen: minder emoji, “punten”-taal, gedempt navy/mint.

### 7.5 Asset-gaten (oplossen, niet negeren)

| Gat | MVP-oplossing | Later |
|---|---|---|
| Geen logo | Wordmark SF Rounded + accent | Echte mark |
| Geen avatar-art | Gebundelde geversioneerde emoji/SF-catalogus; IDs in `packages/shared` | Illustratie-bibliotheek |
| Geen icon-set | Emoji + SF Symbols mappingtabel in shared | Optioneel custom set |
| Kid/teen kleuren inferred | Tokens met comment `// brand-placeholder` | Branding-pass zonder component-herschrijf |
| Level/UI “Level 4” | `lifetimeEarned` → levelcurve server-side | Avatar-items per level |

**Hard:** level **niet** afleiden uit huidig saldo — inwisselen zou level laten dalen = negatieve mechaniek.

---

## 8. App-structuur (in-repo)

```
apps/ios/
├── README.md                 # blijft; verwijst naar dit voorstel
├── project.yml               # XcodeGen (aanbevolen) of .xcodeproj
├── TaakHelden/
│   ├── App/                  # @main, DI-container, scene phase
│   ├── Features/
│   │   ├── Onboarding/       # SIWA, gezinscode, kind aanmaken, QR
│   │   ├── MijnDag/
│   │   ├── Winkel/
│   │   ├── MijnHeld/
│   │   ├── Parent/           # v1: vandaag, approvals, lichte settings
│   │   └── ProfileSwitch/    # multi-child op één device
│   ├── Core/
│   │   ├── API/              # gegenereerde OpenAPI client + auth actor
│   │   ├── Sync/             # MutationQueue (SwiftData) + SyncEngine
│   │   ├── Storage/          # SwiftData mirror (read models)
│   │   ├── Push/             # APNs registratie, deep links
│   │   └── DesignSystem/     # Palette, Spacing, Radius, components
│   └── Resources/            # Localizable.nl, assets, avatars
└── TaakHeldenTests/
```

**Patronen:**

- MVVM of TCA-light — teamkeuze; wel: Views dom, mutaties via één `APIClient` + `MutationQueue`.
- Geen handmatige JSON-DTO’s buiten de generator.
- Feature-folders mirroren tabs; DesignSystem deelt met alle features.
- Strings: `Localizable.xcstrings` NL-first; kind-copy review via `@dutch-child-copy`.

---

## 9. Faseplan (technisch, geen kalender)

### Fase 0 — Contract-fundament (API + shared, parallel aan Xcode-scaffold)

Zonder dit is elke Swift-regel technische schuld.

1. ADR: responsevorm bij rol-endpoints (discriminator).
2. ADR: kind device-refresh + revoke.
3. ADR: één familie-app; Xcode in `apps/ios/`; min. iOS 17.
4. Response-schemas in `packages/shared` voor alles wat iOS raakt; routes gebruiken die schemas.
5. OpenAPI-generatie + CI-drift-check.
6. Uniform `InstanceView` (`photoId` + `photoStatus`) op today én sync.
7. Kind mag eigen `GET /redemptions` (scoped).
8. `lifetimeEarned` (+ level) op balance-response.
9. APNs sandbox/prod + bundle-id splitsen; `PushPayload`-schema.
10. Fix Apple-only account delete; `notification_settings` echt laten meewegen.
11. `ios.yml` scaffold (build/test op macOS-runner wanneer bron er is).

### Fase 1 — MVP kind-app + ouder-onboarding

**Doel:** kind vinkt af (ook offline), ziet punten/streak/winkel/held; ouder kan gezin + kind + code aanmaken via SIWA.

- Scaffold XcodeGen + DesignSystem-tokens + TabView.
- Auth: SIWA ouder; family-code + PIN + Face ID kind; Keychain.
- Mijn Dag / Winkel / Mijn Held (mid + teen palette).
- MutationQueue + `/sync`; confetti/haptics; JPEG foto-bonus.
- Push alerts + deep link naar tab.
- A11y baseline.
- Demo-account / TestFlight-script voor review.

**Exit-criteria:** end-to-end happy path op twee fysieke devices (ouder iPhone + kind iPhone/iPad) tegen staging Worker.

### Fase 2 — v1 ouder-modus + stevige sync

- Ouder-tabs: Vandaag per kind, goedkeuringswachtrij, licht taken/beloningen-beheer, settings.
- FamilyRoom WebSocket-client.
- Stille pushes → background sync; echte delta + `updated_at`.
- `ageMode: young` (ontwerp → implementatie).
- Streakbescherming gelijk trekken met productbelofte (nu te streng).
- In-app accountverwijdering + data-export.
- Widget “nog N taken” (optioneel vroeg als het lean blijft).

### Fase 3 — Later

Watch, coöperatieve gezinsdoelen, avatar-shop, onderhandel-knop (teen), co-ouderschap over twee huishoudens (grote datamodel-breuk — niet half voorbereiden), Android, EN-locale.

---

## 10. Backend-werk dat iOS deblokkeert (prioriteit)

| Prio | Item | Impact |
|---|---|---|
| P0 | OpenAPI + response schemas + rol-discriminator | Codegen / geen drift |
| P0 | Kind device-refresh | Bruikbare kind-app |
| P0 | Ouder kan kind + PIN + code aanmaken (iOS UI; API bestaat) | E2E bereikbaar |
| P0 | APNs sandbox | TestFlight push |
| P1 | InstanceView + photoStatus uniform | Foto-bonus UX |
| P1 | Kind `GET /redemptions` | Winkel “wacht op …” |
| P1 | `lifetimeEarned` / level | Mijn Held eerlijk |
| P1 | PushPayload + content-available | Deep link + stille sync |
| P1 | SIWA account delete | App Store / AVG |
| P2 | Sync delta + `updated_at` | Multi-day offline |
| P2 | `pin` in sync-mutaties | Offline spaardoel |
| P2 | Streak-bescherming vs productcopy | Geen valse belofte |

---

## 11. Risico’s (met mitigeratie)

| Risico | Mitigeratie |
|---|---|
| Handmatige DTO’s → contract-drift | Fase 0 verplicht vóór feature-Swift |
| HEIC/EXIF-strip faalt stil | Altijd JPEG ~2 MP client-side; toon `photoStatus` |
| Parallel token-refresh | Eén actor / lock |
| WS broadcast zonder filter | Kind nooit op WS; alleen ouder-token |
| Placeholder branding herstylen | Alle kleur via Palette; één plek wijzigen |
| Xcode buiten repo | Besluit P6: in-repo |
| Streak UI belooft vergeving die API niet doet | API gelijk trekken vóór prominente streak, of UI-copy temperen |
| Co-ouderschap later = migratie-explosie | Nu **niet** half modelleren; wel documenteren als bewuste non-goal tot fase 3 |
| macOS CI-kosten | `ios.yml` alleen bij `apps/ios` paths; Fastlane op tags |

---

## 12. Wat we bewust níet doen in MVP

- Young-modus (4–7) en mascotte “Vinkie”.
- Volledig ouder-dashboard-pariteit met web (weekplanner drag-drop, inzichten).
- Kids Category (juridisch toetsen; default = Lifestyle/Productivity familie-app).
- Third-party analytics SDK in kind-pad.
- Lokale saldo-authoriteit of “points cache” die de UI vertrouwt boven de server.
- GraphQL / eigen BFF op iOS — praat direct met `/v1` (zelfde contract als web-BFF upstream).

---

## 13. Beslislijst voor kickoff

1. Bevestig **P1–P6** (§3).
2. Keur **fase 0 ADR’s** goed (discriminator, child-refresh, in-repo Xcode).
3. Wijs eigenaar: backend fase 0 || iOS scaffold parallel.
4. Branding-minimum: akkoord op placeholder kid/teen tokens + gebundelde avatar-IDs.
5. Pedagogische/levelcurve-input agenderen vóór Mijn Held “Level N” live zet.

---

## 14. Referenties

- Product: `docs/taakhelden-productvoorstel.md` (§3–6, §8)
- API: `docs/taakhelden-api-specificatie.md`
- Infra: `docs/taakhelden-cloudflare-github-architectuur.md`
- Design: `Design System/readme.md`, `Design System/ui_kits/kid-app/`
- Web tokens: `apps/web/app/globals.css`
- Contract: `packages/shared/src/schemas/`
- Huidige iOS-stub: `apps/ios/README.md`
- Skills: `.claude/skills/ios-dev.md`, `Design System/SKILL.md`
