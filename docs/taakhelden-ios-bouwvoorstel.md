# TaakHelden iOS — bouwvoorstel

*Senior architectuur- + UI-voorstel. Aansluiting op `apps/api`, `apps/web` en `Design System/`. Status: voorstel ter beslissing — geen implementatie.*

**Kopconclusie:** de API is ver genoeg om vandaag te beginnen; de iOS-app is dat niet. Het gat zit niet in “welke SwiftUI-views”, maar in **contractfundament** (OpenAPI/response-schemas — met migratiepad voor de *bestaande* webclient —, kind-sessie-verlenging, APNs-sandbox), **UI-states & gate-ontwerp**, **App Store-compliance** (Face ID/PIN onder 13, familie-metadata, push/foto-dataminimalisatie, één-device review), **privacy-beleid**, **tests**, en **productkeuzes**. Zonder die beslissingen bouwen we drift en herwerk.

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

### 2.2 Rolafhankelijke JSON op één pad — ook een web-breaking change

`/instances/today`, `/points/balance`, `/rewards`, `/families/me`, `/members` geven **andere JSON** afhankelijk van JWT-rol. Voor gegenereerde clients is dat giftig (één operatie = één responstype).

**Oplossing (aanbevolen):** discriminator `viewer: "child" | "parent"` in die responses, gemodelleerd als Swift enum met associated values. Alternatief (aparte paden) is REST-netter maar raakt web + spec harder.

**Dit is geen iOS-only blokkade.** `apps/web` draait vandaag al tegen precies die endpoints (Vandaag, Goedkeuren, Taken, Winkel). Een `viewer`-veld (of gesplitste paden) is een **contractwijziging voor de bestaande web-BFF**, niet alleen voor de toekomstige Swift-client. Wie dit als “iOS-probleem” behandelt, breekt stilletjes het dashboard.

**Migratiepad (verplicht in de fase-0-ADR, niet optioneel):**

| Optie | Wat | Wanneer kiezen |
|---|---|---|
| **A. Dual-shape (aanbevolen)** | API blijft oude parent-shape accepteren/leveren zolang `Accept`/`X-Contract-Version` ontbreekt of `v1` is; nieuwe shape (met `viewer`) achter `v2`. Web-BFF migreert in dezelfde PR-reeks als shared schemas; iOS praat alleen `v2`. Na web-cutover: deprecatieperiode (≥1 release) → oude shape verwijderen. | Minste risico; web blijft groen tijdens iOS-scaffold. |
| **B. Big-bang + gecoördineerde PR** | Eén release: API + `packages/shared` + `apps/web` types/parsers tegelijk. Geen dual-shape. | Alleen als web-wijziging klein is en dezelfde reviewer beide stacks meekrijgt. |
| **C. Aparte paden** | bv. `/instances/today/family` vs `/instances/today/me`. Geen discriminator, wel meer routes + web-URL-wijzigingen. | Als het team discriminator-unions in Zod/Swift wantrouwt. |

De ADR moet expliciet kiezen A/B/C, de geraakte web-bestanden noemen (BFF-proxy + fetchers die today/balance/rewards parsen), en een **exit-criterium** zetten: web typecheck + bestaande Vitest/API-authz groen *vóór* iOS codegen op de nieuwe shape landt.

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
| **P1** | Één app of twee App Store-listings? | **Één familie-app, twee modi** (kind + ouder) | Past bij gedeelde iPad, SIWA-onboarding, parental gate = verborgen gebaar + LA/ouder-login (§5.3). Productvoorstel §6.10 + store-metadata familie-first (§14.1); niet Kids Category. |
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
               → Keychain (accessControl: biometryOrPasscode / applicationPassword)

[Dagelijks]    Ontgrendel-scherm met Face ID/Touch ID **én** zichtbare “Gebruik pincode”
               → refresh access indien nodig
               → géén gezinscode meer

[Ouder]        “Dit toestel loskoppelen” trekt refresh in
```

Backend-werk (fase 0): migratie `child_device_sessions` (of uitbreiding `devices`), `POST /auth/child-session/refresh`, revoke vanuit ouderprofiel.

**Gedeelde iPad:** `POST /devices` ondersteunt al multi-profiel per APNs-token. iOS toont een profielkiezer; wisselen = lokale unlock van ander Keychain-item, geen “één user per app”-aanname.

#### Face ID / biometrie — App Store (onder 13) + LocalAuthentication

App Store Review Guidelines (biometrics / account auth, update juni 2026): apps die gezichtsherkenning voor accountauthenticatie gebruiken moeten voor gebruikers **onder 13** altijd een **alternatieve authenticatiemethode** bieden naast Face ID, en gezichtsherkenning mag **alleen via LocalAuthentication** — niet ARKit of andere vision-API’s.

**Concreet voor TaakHelden (vast in child-refresh-ADR):**

| Regel | Implementatie |
|---|---|
| Alleen LA | `LocalAuthentication` (`LAContext`) voor Face ID / Touch ID; géén ARKit/TrueDepth-custom face auth. |
| Alternatief onder 13 | Voor `ageMode` young **én** mid (geboortejaar → leeftijd < 13) is de **4-cijferige PIN permanent beschikbaar en zichtbaar** op het ontgrendel-scherm (“Gebruik pincode”), niet alleen als fallback ná een mislukte Face ID-poging. |
| Teen (13+) | Face ID mag primair zijn; PIN blijft bereikbaar (instellingen / “Andere opties”) — consistent en eenvoudiger dan twee codepaden. |
| Opt-in | Face ID is aanzetten na koppeling, nooit verplicht; weigeren Face ID = gewoon PIN-first forever. |
| Keychain | Biometrie ontgrendelt het Keychain-item; PIN is de altijd-werkende route naar hetzelfde secret — geen aparte “noodgreep” die verstopt zit. |

Impliciete PIN-only-als-Face-ID-faalt is **niet voldoende** voor review. UI-mock: ontgrendelkaart toont biometrie-prompt **plus** een duidelijke secundaire knop naar het numerieke PIN-pad (§7.2.3).

### 5.3 Parental gate — interactie-ontwerp, niet alleen auth

“Ouder-instellingen achter ouder-login” (§5.3 oud) is een auth-detail, geen UX. Op het **kindtoestel** moet een ouder in ouder-modus kunnen zonder dat het kind dat naäpt. Een zichtbare “Ouder”-tab in kindmodus faalt die toets: het kind kan er gewoon op tikken (en ziet dan hoogstens een login — dat is al een uitnodiging tot proberen).

**Keuze (aanbevolen): verborgen ingang + sterke poort — geen permanente ouder-tab in kindmodus.**

| Stap | Gedrag |
|---|---|
| 1. Ingang | **Geen** tab/knop “Ouder” in de kind-`TabView`. Ingang via verborgen gebaar: lange-druk (≈1,5 s) op het wordmark / avatar in Mijn Held, of 5× tik op de versie/build in een onopvallende hoek. Teen: zelfde gebaar, minder “speels” geformuleerd in VoiceOver-hint alleen voor ouders die het weten (hint staat in de ouder-onboarding, niet in kind-UI). |
| 2. Poort | Direct **LocalAuthentication** (device-eigenaar Face ID / toestelcode) **of** ouder-account (SIWA / e-mail) als er een ouder-sessie op dit device bestaat. Kind-PIN ontgrendelt dit **niet**. |
| 3. Sessie | Korte ouder-sessie op kinddevice (bijv. 5–10 min idle timeout); terugkeer naar kindmodus wist de ouder-UI uit de navigatiestack. |
| 4. Wat achter de poort zit | Goedkeuren, gezinscode tonen, kind loskoppelen, account/instellingen, externe links. Kind-UI heeft geen deep links naar die surfaces. |

**Afgewezen:** permanente ouder-tab; alleen een “reken-sommetje”-gate zonder biometrie (te makkelijk voor mid/teen); kind-PIN als parental gate (kind kent die).

Dit is zowel security als UX — vastleggen in dezelfde ADR als P1 (één app), niet “later wel een knop”.

### 5.4 Gedeelde iPad & iPadOS-multitasking

Gedeelde iPad is een expliciet target (§5.2). Zonder lock ondermijnt multitasking de parental gate net zo goed als een zichtbare ouder-tab: kind opent Safari/Split View naast TaakHelden, of sleept de app naar Stage Manager en bereikt andere apps.

**MVP-keuzes:**

| Onderwerp | Besluit |
|---|---|
| **Guided Access / Screen Time** | Documenteer voor ouders: voor “echt” kind-lock → iOS Schermtijd / Geleide toegang. De app kan dat niet afdwingen zonder MDM. |
| **Split View / Stage Manager** | Kindmodus: **`UIRequiresFullScreen = YES`** (of equivalent Scene-manifest) zodat de app niet in Split View/Stage Manager naast andere apps draait. Trade-off: geen echte multitasking-vriendelijkheid — acceptabel voor een kind-first family-app. |
| **Scene geometry** | Layouts adaptief (compact/regular); iPad gebruikt dezelfde tabs, ruimere kaarten, geen desktop-achtige sidebar in kindmodus. |
| **Multi-profiel** | Profielkiezer bij cold start / na lock; wisselen vereist Face ID of PIN van dat profiel — geen “tik en je bent je broertje”. |
| **Ouder op iPad** | Na parental gate mag regular-size layout (twee kolommen voor goedkeuringsqueue) — zie §7.2. |

Zonder `UIRequiresFullScreen` (of een bewuste afwijzing daarvan in de ADR) is de gate theater.

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
- Optimistische UI: vink + confetti/chime/haptic direct; **puntengetal** komt uit server-response (`newBalance`). Kind mag nooit zien dat punten “weggaan” door sync-correctie — herstel stil of met positieve herformulering.
- `TASK_ALREADY_COMPLETED` (409) = succes voor de UI (“afgevinkt wint”).
- Saldo nooit lokaal sommeren.

### 6.2 Sync-contract verbeteren (fase 0/2)

Huidige `/sync` delta is dun: ledger sinds `since`, instances van *alleen vandaag*, volle rewards-lijst; geen tasks/members/badges/redemptions/tombstones. `task_instances` mist `updated_at`.

**MVP:** pull bij `scenePhase.active`, na eigen mutatie, + `BGAppRefreshTask`.  
**v1:** echte delta (`updated_at` + tombstones) + stille push → background `/sync`.

### 6.3 Realtime

FamilyRoom-WS is **ouder-only** (`POST /ws/token` → `requireParent`). Kind leest geen sibling-events — privacy-invariant. iOS ouder-modus = eerste echte WS-client (web gebruikt hem nog niet). Reconnect met backoff 2/4/8 s; bij reconnect REST-refetch; nooit tight-pollen.

### 6.4 Push

- Tokenregistratie via `POST /devices` (multi-profiel ok) — **opt-in**, na uitleg; weigeren mag de app niet breken.
- **App moet volledig werken zonder push** (Review Guidelines): afvinken, sync, winkel, goedkeuren via openen van de app / pull / WS blijven beschikbaar. Geen “zet meldingen aan om door te gaan”-wall.
- Backend: quiet hours + max 2/dag/kind; copy via stijlgids §3.7.
- Nodig vóór nuttige deep links: `PushPayload` in shared (`type`, `refId`, `childId`) + `content-available` op approve/redo.
- APNs sandbox/productie splitsen (anders TestFlight dood).

**Geen gevoelige info op het lockscreen** (Guidelines + gedeelde iPad):

| Slecht (zichtbaar voor anderen) | Goed |
|---|---|
| “Foto van Kamer opruimen wacht op goedkeuring” | “Er wacht iets op je goedkeuring” |
| “Sam heeft een beloning gekocht” | “Er is nieuws in TaakHelden” |
| Kindnaam / taaktitel / foto-hint in `aps.alert` | Generieke alert; details pas **in-app na ontgrendelen** (deep link → gate of kind-unlock) |

Custom payload mag ids bevatten voor routing; de **zichtbare** alert-tekst blijft generiek. Zelfde regel voor kind-pushes (“Er staat iets leuks klaar” i.p.v. taakinhoud op het lockscreen als het toestel gedeeld wordt).

### 6.5 Foto-bonus — dataminimalisatie (PHPicker / camera)

Fase 1 kiest **geen** volledige Photos-library-toegang (`NSPhotoLibraryUsageDescription` voor unlimited read):

- **Camera** (`UIImagePickerController` / `AVCapture`) voor “maak nu een foto”, of
- **Out-of-process picker** (`PHPickerViewController` / SwiftUI `PhotosPicker`) voor één bestaande foto — systeem deelt alleen de selectie, geen album-scan.

Dat volgt Apple’s dataminimalisatie (vraag alleen wat de functie strikt nodig heeft) en scheelt een zware privacy-uitleg in App Privacy + reviewer notes. Export altijd als **JPEG ~2 MP** vóór upload (geen HEIC naar de brittle EXIF-strip). Lokale staging wissen na geslaagde confirm.

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

### 7.2 Schermen MVP — inclusief states, onboarding, goedkeuren

Happy-path-kits alleen is te dun. Empty/loading/error en onboarding verdienen dezelfde scherpte als de ledger-regels: ze raken **geen negatieve mechanieken** (§1) direct.

#### 7.2.1 Kind-tabs (mid + teen)

| Tab | Bron UI-kit | API |
|---|---|---|
| **Mijn Dag** | `MijnDagScreen` | `GET /instances/today`, `POST …/complete`, undo, photo-flow, `GET /points/balance` |
| **Winkel** | `WinkelScreen` | `GET /rewards`, redeem, pin, eigen redemptions (kind-scope — contract-fix) |
| **Mijn Held** | `MijnHeldScreen` | badges, avatar, level uit `lifetimeEarned` (niet uit balance!) |

Headerpatroon Mijn Dag: `AvatarBadge` + `PointsBadge` + `StreakBadge` — gevoed door server. Geen vierde “Ouder”-tab (§5.3).

#### 7.2.2 Empty / loading / error (kind) — positief kader

| Situatie | Wat het kind ziet | Wat níet |
|---|---|---|
| **Loading** (eerste fetch / pull) | Skeleton-kaarten in cream/navy; geen spinner-wall. Korte copy optioneel: “Even je heldendag laden…” | Lege witte flash; indefinite spinner zonder context |
| **Mijn Dag leeg — alle taken af** | Vierend empty state: groot icoon/avatar-pose, copy à la “Alles gedaan — je bent een TaakHeld vandaag! 🌟”, streak/punten zichtbaar, CTA naar Winkel of “Morgen weer”. Confetti/chime één keer bij binnenkomst als net de laatste taak net af was. | “Geen taken”, grijze void, “kom later terug” |
| **Mijn Dag leeg — nog geen taken toegewezen** | Warm: “Nog geen missies — vraag papa/mama even om er eentje klaar te zetten.” Geen schuld. | “0 tasks” / technische leegte |
| **Winkel — beloning niet betaalbaar** | Kaart blijft tappable voor detail; visueel: lagere opacity **plus** tekst “Nog X punten tot …” (vorm + getal, niet alleen grijs). Geen slot-icoon als “verboden”-metafoor; desnoods spaarvarken/doel-icoon. `affordable=false` ≠ afwijzing. | Rood “te duur”, slot+ketting, disabled zonder uitleg |
| **Winkel leeg** | “Straks staan hier beloningen klaar — pap of mam vult de winkel.” | Error-achtige leegte |
| **Sync hapert / offline met queue** | **Zichtbare, kalme indicator** (kleine cloud/badge bij header of tab): “Wordt bewaard — sturen we zo.” Optimistic vinkjes blijven staan. Bij langdurig falen (>N min of N retries): vriendelijke banner + “Opnieuw proberen”, geen stacktrace. | Volledig stil (kind denkt dat het “niet werkt”) óf blokkerende fullscreen-error |
| **Harde fout (5xx / sessie)** | Kind: read-only lokale mirror + “We kunnen even geen verbinding maken — je afgevinkte taken zijn veilig.” Ouder-poort voor her-auth indien nodig. | Leeg inlogscherm als enige optie (§ open vraag eerder: read-only wint) |
| **Foto verwerken / failed** | Statuschip op de taak: “Foto wordt nagekeken…” / “Foto lukte niet — je mag het nog een keer proberen.” Positief, opnieuw mogen. | Stille fail; “upload error” |

Copy door `@dutch-child-copy`; teen-variant met minder emoji, zelfde structuur.

#### 7.2.3 Onboarding-schermen (niet alleen API-flow)

Onboarding is een **schermreeks**, geen endpoint-lijst. Raakt mid (8+) nu al — niet alleen de uitgestelde young-modus.

**Ouder (MVP):**

1. Welkom / SIWA (primair).
2. Gezinsnaam (optioneel kort).
3. Kind aanmaken: roepnaam + geboortejaar (ageMode) + avatar kiezen uit grid.
4. PIN instellen voor dat kind (ouder typt/bevestigt) + toestemmingstekst AVG art. 8.
5. Gezinscode + QR tonen (“houd dit bij het kindertoestel”) + eerste templates hint.

**Kind — koppelen (MVP, mid-first maar beeldrijk):**

1. **Gezinscode:** zes grote vakken; numeriek toetsenbord; optioneel QR-scan (camera). Geen lange uitleg-paragraphs.
2. **Profielkiezer:** grote avatar-tegels (roepnaam eronder); één tik = selectie. Geen dropdown.
3. **Avatar bevestigen / kiezen** (als ouder nog placeholder zette): grid met diverse opties (emoji-catalogus MVP); grote tap-targets (≥44 pt, liever 64+).
4. **PIN invoeren:** **numerieke PIN-pad** (4 cijfers), grote toetsen, geen QWERTY. Visuele feedback als dots/stenen, niet alleen tekst. Mid mag cijfers zien; young later: beeld-gebaseerd patroon (3 dieren in volgorde) als apart ontwerp — niet improviseren in mid door “maar iets met plaatjes”.
5. Face ID / Touch ID **opt-in** voor volgende keren (“Zal Face ID je de volgende keer helpen?”). Weigeren = PIN-first. Ontgrendel-UI toont daarna altijd een zichtbare PIN-route voor kinderen onder 13 (§5.2) — ook als Face ID aan staat.

Teen: zelfde flow, strakkere typografie, minder confetti bij “je bent gekoppeld”.

#### 7.2.4 Ouder — goedkeuringsqueue (v1, wél gespecificeerd)

“Licht in v1” mag geen blanco UI betekenen. Minimumscherm-spec:

| Element | Gedrag |
|---|---|
| **Wachtrij** | Lijst gesorteerd op oudste eerst; groepering **per kind** (sectieheaders met avatar) wanneer >1 kind openstaande items heeft. Badge-count op de gate-entry. |
| **Kaart per item** | Kindnaam, taaktitel, tijdstip, thumbnail als `photoStatus=ready`, anders statuschip. |
| **Foto bekijken** | Tik thumbnail → fullscreen viewer (pinch-to-zoom, swipe dismiss). Geen EXIF/locatie tonen. |
| **Acties** | Per item: **Goedkeuren** / **Nog even kijken** (redo + verplicht kort positief notitieveld voor het kind). |
| **Bulk** | MVP: **selectie-modus** — meerdere items van *hetzelfde kind* goedkeuren in één go (één Idempotency-Key per item, parallel met limiet). Geen “keur heel het gezin goed” zonder kijken als er foto’s bij zitten; items mét foto vereisen openen of expliciete “ik heb ze gezien”-check in bulk-sheet. |
| **Leeg** | “Niets te keuren — lekker rustig.” (ouder-toon, kalm) |
| **iPad** | Regular width: master-detail (lijst | detail+foto). |

Push deep-link opent dit scherm achter de parental gate (§5.3).

### 7.3 Tokens → SwiftUI

| DS | SwiftUI |
|---|---|
| `tokens/colors.css` | Asset catalog + `Palette` protocol; raw hex alleen in token-laag |
| Fredoka (web-substituut) | **SF Rounded** (`Font.system(…, design: .rounded)`) — niet Fredoka bundelen |
| spacing 4…64 | `Spacing` enum |
| radius 6/10/16/24 | kid = xl, teen = 12, parent = default |
| `--shadow-kid` | warm coral shadow; kit gebruikt soms `shadow-sm` — **iOS volgt intended warm shadow** |
| Beloningsmoment | Confetti **of** Reduce-Motion-alternatief (§7.4); chime + haptic als kanalen |
| Emoji-iconen | MVP ok; mapping `icon` string → SF Symbol + emoji-fallback in shared catalogus |

**Bewust niet overnemen:** `SidebarNav` (web-only). iOS = `TabView` (3 kind-tabs).

### 7.4 Motion, geluid, haptics & toegankelijkheid

- **Beloningsmoment = multi-kanaal**, niet “alleen confetti”:
  - Visueel: check-animatie + confetti (milestone).
  - **Haptic:** `UINotificationFeedbackGenerator` `.success` bij afvinken (altijd, tenzij systeem haptics uit staan).
  - **Geluid:** korte chime (gebundeld, <0,5 s, geen stem) bij complete/milestone; respecteer **stille schakelaar** en `AVAudioSession` ambient; ouder-setting “geluiden aan/uit” achter parental gate.
- **Reduce Motion aan:** confetti/Lottie **vervangen**, niet weglaten. Alternatief: korte scale+glow op de check, badge “+N” die in-place fade’t, optioneel subtiele kleurflits op de kaart — zelfde celebratory intent, lage vestibulaire load. Chime + haptic blijven (tenzij apart uit). Zo verdwijnt het beloningsmoment niet juist voor kinderen die overprikkelingsgevoelig zijn.
- Dynamic Type, VoiceOver-labels (emoji), ≥ 44 pt targets; status nooit alleen op kleur.
- Teen: minder emoji/ornament; chime mag blijven (korter/neutraler sample).

### 7.5 Dark mode, contrast-contract, asset-gaten

#### Dark mode — expliciet uitgesteld

Kid/teen-paletten zijn al *inferred*. SwiftUI-defaults zouden stil een halfbakken dark surface tonen die het warme cream/navy-register breekt.

**Besluit MVP/v1 kindmodus: dark mode uit** (`UIUserInterfaceStyle` light geforceerd voor kind-scenes, of palette zonder dark-asset-varianten). Oudermodus mag later system dark volgen (aansluiting op web-dashboard). Branding-pass heropent de vraag; tot die tijd geen “per ongeluk dark”.

#### Contrast-contract op de Palette-laag

Placeholder-tokens krijgen wél een harde lat, zodat de latere branding-pass geen contrast-schuld erft:

- Elke `Palette`-combinatie tekst-op-vlak (body, muted, onAccent, badge-text op soft fills) moet **WCAG 2.1 AA** halen (normaal tekst ≥ 4,5:1; groot ≥ 3:1).
- Unit-test of snapshot-helper in `TaakHeldenTests` / DesignSystem-tests: faalt CI als iemand `#FFE1DA` op `#FFF8EC` als body-tekst zet.
- Geldt voor kid, teen en parent palettes; één plek wijzigen (§ kernprincipe) = één test suite.

#### Asset-gaten

| Gat | MVP-oplossing | Later |
|---|---|---|
| Geen logo | Wordmark SF Rounded + accent | Echte mark |
| Geen avatar-art | Gebundelde geversioneerde emoji/SF-catalogus; IDs in `packages/shared` | Illustratie-bibliotheek |
| Geen icon-set | Emoji + SF Symbols mappingtabel in shared | Optioneel custom set |
| Kid/teen kleuren inferred | Tokens + contrast-tests; `// brand-placeholder` | Branding-pass zonder component-herschrijf |
| Level/UI “Level 4” | `lifetimeEarned` → levelcurve server-side | Avatar-items per level |
| Dark mode | Expliciet uit (kind) | Na branding heroverwegen |

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

## 9. Testsstrategie

`TaakHeldenTests/` en een macOS-runner in `ios.yml` zijn geen strategie — alleen een map en een kostenpost. Sync/ledger-verzoening (optimistic UI, idempotency, undo-window, foto-pipeline) is precies het soort logica dat stilletjes punten verdubbelt of verdwijnt als je alleen “happy path op een device” test.

### 9.1 Wat we wél testen (minimum)

| Laag | Wat | Waar / hoe |
|---|---|---|
| **Contract** | Gegenereerde Swift-modellen decoderen tegen fixtures die uit de Zod/OpenAPI-schemas komen (parent- én child-`viewer`, foutenvelopes, `SyncResponse`) | `TaakHeldenTests/Contract/` — CI faalt als shared schema wijzigt zonder fixture-update (zelfde drift-guard als web/API) |
| **Palette contrast** | WCAG AA op tekst/vlak-paren in kid/teen/parent palettes (§7.5) | `TaakHeldenTests/DesignSystem/` — blokkeert contrast-regressie bij branding-tweaks |
| **MutationQueue (unit)** | Edge cases die de ledger raken — zie §9.2 | Pure Swift-tests, geen netwerk; queue + fake clock + in-memory store |
| **Auth/Keychain (unit)** | Seriële refresh-actor: parallelle 401’s → één refresh; kind device-refresh revoke | Actor-tests met stubbed URLProtocol |
| **API-regressie (bestaand)** | Authz, idempotency, ledger-invarianten blijven in Workers Vitest | `apps/api/test` — iOS introduceert geen bypass; nieuwe velden krijgen daar een test mee |
| **Web co-migratie** | Na discriminator/versiebump: web typecheck + dashboard-fetchers tegen nieuwe shape | Fase-0 exit-criterium (§2.2) — geen iOS-merge vóór web groen |
| **Smoke (manual / later UI)** | Twee devices: afvinken offline → sync; goedkeuren → kind ziet update | TestFlight; UI-tests (XCUITest) pas als TabView stabiel is — niet MVP-blocker |

### 9.2 MutationQueue — verplichte edge cases

Deze scenarios moeten als benoemde unit-tests bestaan vóór “offline afvinken” als klaar geldt:

1. **`TASK_ALREADY_COMPLETED` (409)** — tweede complete (retry of sibling-device) → queue-item **succes** afronden, geen error-UI, saldo uit response/sync.
2. **`INSUFFICIENT_POINTS` bij redeem** — rejected response is ook gecached (7 d KV): queue mag **niet** blijven spammen; mutatie definitief droppen + positieve NL-copy.
3. **Stabiele Idempotency-Key** — zelfde intent na app-kill + herstart hergebruikt dezelfde UUID; nieuwe tik = nieuwe key.
4. **Undo-window** — offline complete nog in queue: undo trekt queue-entry in (geen server-undo). Na sync + >5 min: `UNDO_WINDOW_EXPIRED` → oeps-knop weg, geen schuldcopy.
5. **Dubbele foto-upload** — twee confirms/attach voor dezelfde instance: tweede is no-op of nette fout; géén dubbele bonuspunten; lokale staging-file één keer geconsumeerd.
6. **Partial sync-batch** — mix van applied + rejected in één `/sync`-response: applied committen, rejected per-key afhandelen, rest van de queue bewaren.
7. **Saldo nooit lokaal “winnen”** — na optimistic confetti corrigeert UI naar `newBalance` zonder zichtbare “punten afgenomen”-animatie.

### 9.3 CI-discipline

- `ios.yml`: unit + contract-tests op elke PR die `apps/ios` raakt; macOS-minuten niet verspillen aan XCUITest in elke PR.
- Contract-fixtures worden gegenereerd of gekopieerd uit `packages/shared` in dezelfde pipeline als OpenAPI — één bron.
- Geen merge van sync-features zonder de §9.2-lijst groen.

---

## 10. Privacy (beleid — niet alleen code)

Code-invarianten (“geen kind-PII in logs”, EXIF-strip, family-scoped repo’s) zijn nodig maar niet voldoende. Vóór er kinderfoto’s door R2 gaan moet zichtbaar zijn dat we **ook beleidsmatig** hebben nagedacht. Dit hoofdstuk is bewust kort; het vervangt geen DPIA, het markeert de openingen die de DPIA moet vullen.

### 10.1 Wat al in product/code zit (herhaling ter afbakening)

- Grondslag: oudertoestemming (AVG art. 8); vastgelegd bij kindprofiel-aanmaak.
- Minimalisatie: kind = roepnaam + geboortejaar; geen e-mail/telefoon/locatie.
- Foto’s: TLS in transit; EXIF/GPS-strip vóór `ready`; lifecycle **30 dagen** daarna purge (cron).
- Recht op wissen: soft delete + cascade; export-job; App Store eist in-app delete (SIWA-pad fixen, §5.1).
- Geen third-party analytics/ads in het kind-pad.

### 10.2 Beleid dat dit voorstel wél vastlegt (of expliciet openzet)

| Onderwerp | Voorstel / status | Actie vóór foto’s in productie |
|---|---|---|
| **Foto-retentie** | 30 dagen na upload/ready, daarna harde R2 + DB-purge (bestaande belofte). Failed uploads: object zo snel mogelijk weg (nu al bij strip-fail). | Bevestigen in privacyverklaring + ouder-UI (“foto’s worden na 30 dagen gewist”). Geen stille verlenging “voor support”. |
| **Encryptie at rest** | D1/R2 bij Cloudflare (EU/`weur` + R2 jurisdiction `eu`) — provider-managed encryption. Geen extra app-side E2E naar de ouder (web moet kunnen tonen). | In verwerkingsovereenkomst / subprocessors-lijst vastleggen; geen belofte van “E2E die wij niet kunnen lezen” zolang ouder-dashboard foto’s toont. |
| **Wie kan bij gezinsdata?** | Productpad: alleen family-members via JWT + `familyId`-scope. **Support/admin:** standaard **niemand** — geen god-mode dashboard in MVP. | Als support later nodig is: break-glass met audit-log, time-limited access, 4-ogen, geen structurele “lees alle gezinnen”-rol. Ops-toegang tot CF-dashboard = subprocessors-risico → beperken tot named accounts + MFA. |
| **Logs & crash reporting** | Geen namen, geen foto-URLs, geen tokens. Crashlytics-achtige SDK’s: **niet** in kind-target; indien ouder-only, PII-filters verplicht. | Schriftelijke log-richtlijn in runbook; CI/review-checklist (bestaande iOS-skill). |
| **Datalek-proces** | Nog niet uitgewerkt in repo. | Kort incident-runbook vóór launch: detectie → containment (tokens revoken, R2-lifecycle) → beoordeling meldsplicht AP (72 u) → ouders informeren in begrijpelijke NL → postmortem. Eigenaar: security/PO. |
| **DPIA** | Productvoorstel eist DPIA vóór launch (kindergegevens = hoog risico). | DPIA als fase-1 exit-criterium voor **productie**-foto’s; staging mag met synthetische/ouder-eigen testfoto’s. |
| **Subprocessors** | Cloudflare (Worker/D1/R2/DO), Apple (SIWA/APNs), evt. e-mailprovider voor invites. | Publiceer lijst + EU-region claim; geen US-only analytics “even snel”. |

### 10.3 iOS-specifieke privacy-keuzes

- Foto’s: alleen **camera** of **PHPicker/PhotosPicker** (één selectie) — geen full Photo Library entitlement (§6.5). Staging wissen na upload; JPEG ~2 MP.
- Keychain voor tokens; Face ID via **LocalAuthentication** only; PIN blijvend zichtbaar voor onder 13 (§5.2).
- Push: app werkt zonder; zichtbare alert-tekst generiek — geen kindnamen/taaktitels/foto-hints op het lockscreen (§6.4). Ids alleen in stille/custom payload.
- Privacyverklaring + toestemmingsmoment bereikbaar achter parental gate; kind-UI linkt niet naar externe web zonder poort.

**Ondergrens:** geen productie-APNs-fotoflow naar echte gezinnen tot retentie-copy, subprocessors-lijst en datalek-runbook (concept) bestaan — ook als de code al “werkt”.

---

## 11. Faseplan (technisch, geen kalender)

### Fase 0 — Contract-fundament (API + shared + web, parallel aan Xcode-scaffold)

Zonder dit is elke Swift-regel technische schuld.

1. ADR: responsevorm bij rol-endpoints (discriminator **of** gesplitste paden) **inclusief web-migratiepad** (§2.2 optie A/B/C), geraakte BFF/fetchers, versieheader of dual-shape, en exit-criterium “web typecheck + tests groen vóór iOS `v2`-codegen”.
2. ADR: kind device-refresh + revoke; **Face ID alleen via LocalAuthentication; PIN permanent zichtbaar als alternatief voor kinderen onder 13** (§5.2).
3. ADR: één familie-app; parental gate = verborgen gebaar + LA/ouder-login (geen ouder-tab); kindmodus `UIRequiresFullScreen`; Xcode in `apps/ios/`; min. iOS 17; **dark mode kind expliciet uit** tot branding-pass.
4. Response-schemas in `packages/shared` voor alles wat iOS **én** web raakt; routes gebruiken die schemas.
5. OpenAPI-generatie + CI-drift-check; contract-fixtures voor Swift (§9).
6. Uniform `InstanceView` (`photoId` + `photoStatus`) op today én sync.
7. Kind mag eigen `GET /redemptions` (scoped).
8. `lifetimeEarned` (+ level) op balance-response.
9. APNs sandbox/prod + bundle-id splitsen; `PushPayload`-schema.
10. Fix Apple-only account delete; `notification_settings` echt laten meewegen.
11. `ios.yml` scaffold (unit + contract-tests op macOS-runner wanneer bron er is).
12. Privacy-minimum op papier: retentie-copy, subprocessors-lijst, datalek-runbook-concept (§10) — blokkeert geen scaffold, wél productie-foto’s.

### Fase 1 — MVP kind-app + ouder-onboarding

**Doel:** kind vinkt af (ook offline), ziet punten/streak/winkel/held; ouder kan gezin + kind + code aanmaken via SIWA.

- Scaffold XcodeGen + DesignSystem-tokens + TabView (3 kind-tabs; geen ouder-tab).
- Auth: SIWA ouder; onboarding-schermen §7.2.3 (profielgrid, numerieke PIN-pad); Face ID opt-in via LA + **altijd zichtbare PIN** voor onder 13; Keychain.
- Parental gate §5.3 + iPad `UIRequiresFullScreen` §5.4; dark mode kind geforceerd light.
- Mijn Dag / Winkel / Mijn Held met empty/loading/error-states §7.2.2 (vierend “alles af”, “nog X punten”, sync-indicator).
- MutationQueue + `/sync`; beloningsmoment = confetti **of** Reduce-Motion-alternatief + chime + haptic (§7.4).
- Foto-bonus: **PHPicker of camera only** (§6.5), JPEG ~2 MP — geen full library access.
- Push opt-in; app bruikbaar zonder; generieke lockscreen-teksten (§6.4).
- Palette contrast-tests (WCAG AA) in CI (§7.5).
- Unit-tests §9.2 groen vóór “offline afvinken” als done.
- Push deep links achter gate waar nodig.
- A11y baseline (Dynamic Type, VoiceOver, Reduce Motion-pad).
- **App Review-pakket (één device):** demo-ouderaccount + voorgeconfigureerde **gezinscode + kind-PIN** + korte review notes (hoe parental gate, hoe kindflow zonder tweede telefoon). Zie §14.2.
- DPIA gestart; staging-foto’s alleen synthetisch / ouder-eigen.

**Exit-criteria:** end-to-end happy path op twee fysieke devices (ouder iPhone + kind iPhone/iPad) tegen staging Worker; web blijft groen op het gekozen contract-migratiepad.

### Fase 2 — v1 ouder-modus + stevige sync

- Ouder achter gate: Vandaag per kind, **goedkeuringsqueue §7.2.4** (foto fullscreen, bulk zelfde kind, master-detail iPad), licht taken/beloningen-beheer, settings (o.a. geluid aan/uit).
- FamilyRoom WebSocket-client.
- Stille pushes → background sync; echte delta + `updated_at`.
- `ageMode: young` (ontwerp → implementatie; beeld-PIN/voorleesknop).
- Streakbescherming gelijk trekken met productbelofte (nu te streng).
- In-app accountverwijdering + data-export.
- Widget “nog N taken” (optioneel vroeg als het lean blijft).
- Privacyverklaring + datalek-runbook af; DPIA afgerond vóór echte kinderfoto’s in productie.

### Fase 3 — Later

Watch, coöperatieve gezinsdoelen, avatar-shop, onderhandel-knop (teen), co-ouderschap over twee huishoudens (grote datamodel-breuk — niet half voorbereiden), Android, EN-locale; eventuele break-glass support-toegang met audit (§10.2).

**Uitwerking:** zie [`docs/ios-phase3-plan.md`](ios-phase3-plan.md) (epics, contract, ADR's, exit-criteria).

---

## 12. Backend-werk dat iOS deblokkeert (prioriteit)

| Prio | Item | Impact |
|---|---|---|
| P0 | OpenAPI + response schemas + rol-discriminator **+ web co-migratie** (§2.2) | Codegen / geen drift / web niet breken |
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

## 13. Risico’s (met mitigeratie)

| Risico | Mitigeratie |
|---|---|
| Handmatige DTO’s → contract-drift | Fase 0 verplicht vóór feature-Swift |
| Discriminator/versiebump breekt `apps/web` | Expliciet migratiepad in ADR (§2.2); web groen = exit-criterium vóór iOS `v2` |
| HEIC/EXIF-strip faalt stil | Altijd JPEG ~2 MP client-side; toon `photoStatus` |
| Parallel token-refresh | Eén actor / lock |
| WS broadcast zonder filter | Kind nooit op WS; alleen ouder-token |
| Optimistic sync dubbelt punten / stuck queue | Unit-tests §9.2 + bestaande API idempotency-tests |
| Privacy “goed in code”, zwak in beleid | §10-minimum vóór productie-foto’s; DPIA |
| Zichtbare ouder-tab / Split View omzeilt gate | Verborgen gebaar + LA (§5.3); `UIRequiresFullScreen` (§5.4) |
| Face ID zonder PIN-alternatief onder 13 | Ontgrendel-UI: PIN altijd zichtbaar; alleen LocalAuthentication (§5.2) |
| Listing oogt als kinderapp → gedwongen Kids Category | Familie-first metadata (§14.1); juridisch/marketing review vóór submit |
| Reviewer kan kindflow niet op 1 device | Review notes: gezinscode + kind-PIN (§14.2) |
| Gevoelige push op gedeeld lockscreen | Generieke `aps.alert`; details in-app (§6.4) |
| Full Photos-access onnodig | PHPicker / camera only (§6.5) |
| Reduce Motion = geen beloning | Vervangend visueel moment + chime/haptic (§7.4) |
| Placeholder kleuren zakken onder AA | Contrast-contract-tests op Palette (§7.5) |
| SwiftUI dark mode “per ongeluk” | Kind light geforceerd tot branding-besluit |
| Placeholder branding herstylen | Alle kleur via Palette; één plek wijzigen |
| Xcode buiten repo | Besluit P6: in-repo |
| Streak UI belooft vergeving die API niet doet | API gelijk trekken vóór prominente streak, of UI-copy temperen |
| Co-ouderschap later = migratie-explosie | Nu **niet** half modelleren; wel documenteren als bewuste non-goal tot fase 3 |
| macOS CI-kosten | `ios.yml` alleen bij `apps/ios` paths; unit/contract per PR, XCUITest spaarzaam; Fastlane op tags |

---

## 14. App Store-positionering, metadata & review

### 14.1 Kids Category-grens is scherper dan “geen kids in de titel”

Niet in de Kids Category zitten is **niet** alleen: vermijd het woord “kids” in de naam. Guidelines (juni 2026): apps **buiten** de Kids Category mogen in naam, subtitel, icoon, screenshots of beschrijving **niet impliceren dat kinderen de primaire doelgroep zijn** — ook zonder het woord “kids”. Review trekt de listing anders alsnog richting Kids Category (met alle Kids-eisen).

Tegelijk: het verbod op third-party analytics/ads geldt niet alleen formeel voor Kids Category, maar voor elke app die **op functionaliteit** primair voor kinderen bedoeld is — consistent met wat we al uitsluiten.

| Surface | Wel (familie-app) | Niet (kinderapp-signaal) |
|---|---|---|
| Naam / subtitel | “TaakHelden — taken & beloningen voor het gezin” | “De app voor kinderen…”, “kids chores”, speelse kind-only claim |
| Icoon / screenshots | Ouder + kind samen, dashboardachtige ouderflows én kindtabs; Lifestyle/Productivity-framing | Alleen kind-UI, speelgoedachtig icoon, “voor jouw kind”-hero |
| Beschrijving | Ouders beheren; kinderen verdienen punten in een veilige gezinsruimte | “Gemaakt voor kinderen van 4–12”, onderwijskundige kind-first pitch zonder ouderrol |
| Categorie | Lifestyle of Productivity | Kids Category (bewuste non-keuze tot juridische toets anders beslist) |
| Age rating / privacy | Eerlijk over data; geen tracking in kind-pad | Verborgen tracking “alleen voor ouders” die toch kind-events meeneemt |

**Product waarheid vs. store-framing:** de *inhoud* is kind-first; de *listing* is familie-first. Dat is geen greenwashing richting review — het matcht P1 (één familie-app met kindermodus) en productvoorstel §6.10. Juridisch/marketing laten meelezen vóór submit.

### 14.2 Reviewaanpak voor een twee-rollen-app

Apple eist volledige toegang tot accountgebonden functionaliteit: werkende demo-credentials **of** een volwaardige demomodus. Onze happy path veronderstelt twee devices — review gebeurt vaak op **één** toestel.

**Review notes (fase 1 deliverable) bevatten minimaal:**

1. Demo-ouderlogin (SIWA-testaccount of e-mail/wachtwoord op staging).
2. Voorgeconfigureerde **gezinscode + kind-PIN** + welk demo-kindprofiel.
3. Stappen: ouderflow → code tonen → “log uit / wissel naar kind” op hetzelfde device met die code+PIN (geen tweede iPhone nodig).
4. Parental gate: welk gebaar + dat device-passcode/Face ID van het review-toestel de poort is.
5. Push: vermelden dat de app zonder meldingen werkt; eventuele test-pushes zijn generiek geformuleerd.
6. Foto: PHPicker/camera only — geen full library permission-dialog verwacht.

Demodata bevat geen echte kinderfoto’s; synthetische placeholders in de goedkeuringsqueue.

### 14.3 Wat we bewust níet doen in MVP (overig)

- Young-modus (4–7) en mascotte “Vinkie”.
- Volledig ouder-dashboard-pariteit met web (weekplanner drag-drop, inzichten).
- Formele Kids Category (default = Lifestyle/Productivity familie-app; metadata volgens §14.1).
- Third-party analytics/ads in het kind-pad (én geen “stiekem” via ouder-SDK over kind-events).
- Lokale saldo-authoriteit of “points cache” die de UI vertrouwt boven de server.
- GraphQL / eigen BFF op iOS — praat direct met `/v1` (zelfde contract als web-BFF upstream).
- God-mode support-toegang tot gezinsdata / kinderfoto’s.
- XCUITest-dekking van alle flows (eerst unit + contract; UI-smoke later).
- Permanente “Ouder”-tab in kindmodus; kind-PIN als parental gate.
- Dark mode in kindmodus (tot bewuste branding-beslissing).
- Beeld-gebaseerde PIN voor mid improviseren (hoort bij young-ontwerp).
- Confetti weglaten bij Reduce Motion zonder vervangend beloningsmoment.
- Full Photo Library-access voor de foto-bonus.
- Push verplicht stellen of taak-/kinddetails in lockscreen-alerts.
- Face ID zonder permanente zichtbare PIN-route voor onder 13; biometrie via iets anders dan LocalAuthentication.

---

## 15. Beslislijst voor kickoff

1. Bevestig **P1–P6** (§3), inclusief parental-gate-interactie (§5.3), iPad full-screen (§5.4), en **App Store familie-metadata** (§14.1).
2. Keur **fase 0 ADR’s** goed (discriminator **+ web-migratiepad A/B/C**, child-refresh **+ Face ID/PIN onder 13**, in-repo Xcode, dark mode uit).
3. Wijs eigenaar: backend+web fase 0 || iOS scaffold parallel (web-reviewer verplicht bij contract-PR).
4. Branding-minimum: akkoord op placeholder kid/teen tokens + gebundelde avatar-IDs + **AA-contrast-contract**; store-listing-toon familie-first.
5. Pedagogische/levelcurve-input agenderen vóór Mijn Held “Level N” live zet.
6. Akkoord op privacy-ondergrens (§10), testminimum (§9), UI-states (§7.2), push/foto-Guidelines (§6.4–6.5), en review-pakket één device (§14.2).

---

## 16. Referenties

- Product: `docs/taakhelden-productvoorstel.md` (§3–6, §8)
- API: `docs/taakhelden-api-specificatie.md`
- Infra: `docs/taakhelden-cloudflare-github-architectuur.md`
- Design: `Design System/readme.md`, `Design System/ui_kits/kid-app/`
- Web tokens: `apps/web/app/globals.css`
- Contract: `packages/shared/src/schemas/`
- Huidige iOS-stub: `apps/ios/README.md`
- Skills: `.claude/skills/ios-dev.md`, `Design System/SKILL.md`
- App Store Review Guidelines (Apple, laatste check juni 2026) — biometrics/auth onder 13, Kids Category vs. metadata, push, photo dataminimalisatie, demo-access voor review
