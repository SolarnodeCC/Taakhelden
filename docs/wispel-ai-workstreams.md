# Wispel — AI-workstreams

**Status:** scope voorgesteld (PO, 2026-08-06) — beleid in [ADR-0006](./adr/ADR-0006-ai-policy-and-approved-use-cases.md)
**Audience:** eng + PO + security
**Companion van:** [`wispel-build-plan-workstreams.md`](./wispel-build-plan-workstreams.md) · [`wispel-post-review-workstreams.md`](./wispel-post-review-workstreams.md)

**Locked (overgenomen, niet heropenen zonder ADR):** privacy first · gratis voor gezinnen ·
donaties alleen ouder-facing · geen ads/child-tracking · de acht harde architectuurregels in
`CLAUDE.md` · AI-1 t/m AI-4 en R1–R6 uit ADR-0006.

---

## 1. Sequencing — waarom in deze volgorde

Twee van de vijf streams raken geen gebruikersdata en kunnen **nu** starten. De drie die dat wel
doen, staan achter een gate. Dat is geen voorzichtigheidsritueel: het `/privacy`-artefact is
tegelijk de Apple 5.1.2(i)-verplichting, dus het moet er hoe dan ook zijn vóór er één prompt
richting Cloudflare gaat.

| Volgorde | Stream | Blokkeert op |
| --- | --- | --- |
| 1 | `WS-AI-DEVLANE` | Niets — start nu |
| 2 | `WS-AI-WEBPOLICY` | Niets — start nu; levert het `/privacy`-artefact op |
| 3 | `WS-AI-GUARD` (fase T0) | Gate G3 (trust gate) — het is een wijziging in `WS-PROPOSAL`-gebied |
| 4 | `WS-AI-INSIGHT` | **Gate G-AI** (hieronder) — de eerste echte modelaanroep over gezinsdata |
| 5 | `WS-AI-ONDEVICE` | Geparkeerd tot `WS-AI-INSIGHT` een kwartaal draait |

### Gate G-AI — eerste modelaanroep over gezinsdata

Geen PR die `c.env.AI` aanroept met gezinsafgeleide input mag naar `main` totdat:

| Moet waar zijn | Bewijs |
| --- | --- |
| DPIA §5b afgerond en juridisch getoetst | Getekende DPIA-sectie |
| `/privacy` §"AI bij Wispel" live in NL + EN, subprocessorlijst bijgewerkt | Publieke pagina |
| Ouder-toggle bestaat, default **uit**, intrekbaar; kill switch werkt | Authz-test + handmatige verificatie van de KV-flag |
| Nederlandse eval-set met before/after vastgelegd | Eval-artefact in de PR |
| Geen kind-PII in enige prompt | Codereview + test die de promptbouwer voedt met een gezin vol namen en asserteert dat geen enkele naam in de payload voorkomt |
| App Store privacy-labels + age rating opnieuw beoordeeld | Notitie in `WS-IOS-STORE`-checklist |

---

## 2. Workstream-catalogus

| ID | Naam | Trede | Owner archetype | Gate |
| --- | --- | --- | --- | --- |
| **WS-AI-DEVLANE** | AI in de toolchain, niet in het product | n.v.t. | Knowledge + Eng | — |
| **WS-AI-WEBPOLICY** | AI-beleid voor wispel.cc + `/privacy` §AI | T0 | Web + Marketing + Security | — |
| **WS-AI-GUARD** | Veiligheidsvlag op Taakvraag-tekst | T0 → T2 | Backend + Security | G3 |
| **WS-AI-INSIGHT** | Gesprekskaart-samenvatting voor ouders | T2 | Backend + Web + AI | **G-AI** |
| **WS-AI-ONDEVICE** | Zelfde samenvatting on-device (iOS 26+) | T1 | iOS | Geparkeerd |

Conventies uit de codebase: Zod-schemas in `packages/shared/src/schemas/*.ts`, re-export via
`index.ts`; repo-functies met `familyId` als eerste argument; migraties zijn nieuwe genummerde
bestanden vanaf **0014** met een `.verify.sql`-zusje; routes praten nooit met D1.

---

## 3. WS-AI-DEVLANE — AI in de toolchain, niet in het product

**Doel:** de winst pakken die nul gebruikersrisico heeft. Wij gebruiken al agents (`.claude/agents/`)
om code te reviewen en copy te schrijven; dat is AI-gebruik en het verdient dezelfde discipline
als productcode, alleen andere regels.

| In scope | Out of scope |
| --- | --- |
| `@dutch-child-copy` als vaste stap bij nieuwe kindstrings | Copy automatisch mergen zonder mens |
| i18n-sleutelpariteit `nl.json` ↔ `en.json` als agent-check | Machinevertaling live in het product |
| Synthetische testdata en fixtures genereren | Productiedata kopiëren naar een prompt |
| Review-agents (`@architecture-reviewer`, `@ui-design-reviewer`) | Agents merge-rechten geven |

**Harde regel:** **nooit productiedata in een prompt.** Geen echte gezinsrijen, geen kinderfoto's,
geen ledger-dumps, geen D1-export — ook niet "even snel om een bug te reproduceren". Synthetische
fixtures of niets. Dit geldt voor elke agent, ook externe (Claude Code), omdat de toolchain buiten
het productpad valt en dus buiten AI-4 — maar níet buiten AI-1.

**Acceptatiecriteria:**
1. `.claude/rules/ops/ci-and-agent.md` bevat de "geen productiedata in prompts"-regel.
2. Nieuwe kindgerichte strings passeren aantoonbaar `@dutch-child-copy` (PR-checklist).
3. Geen agent heeft schrijfrechten op `main`.

**Docs to update:** `.claude/rules/ops/ci-and-agent.md`, `docs/claude-code-setup.md`.

---

## 4. WS-AI-WEBPOLICY — AI-beleid voor wispel.cc

**Status: geïmplementeerd (interim — zie noot bij AC4).**

**Doel:** bepalen hoe AI zich tot onze website verhoudt — in beide richtingen. Wat mag er van
buiten op onze site (crawlers, widgets), en wat vertellen wij over ons eigen AI-gebruik.

| In scope | Out of scope |
| --- | --- |
| `/privacy` sectie **"AI bij Wispel"** (NL + EN) | De AI-feature zelf bouwen |
| Subprocessorrij Cloudflare Workers AI, met "alleen indien ingeschakeld"-formulering | Nieuwe subprocessors toevoegen |
| CSP/beleid: geen third-party AI-script, geen chatwidget, op geen enkele pagina | Analytics-besluiten (blijft: geen) |
| Crawler-beleid voor AI-bots vastleggen (`robots.txt` + Cloudflare AI Crawl Control) | Betaalde crawler-deals |
| `llms.txt` met feitelijke productbeschrijving | SEO-artikelen (O29, later) |

**Waarom `llms.txt` en crawler-beleid hier thuishoren:** ouders vragen assistenten steeds vaker
"welke klusjes-app is veilig voor mijn kind". Als wij niets publiceren, antwoorden die modellen
uit reviewsites en concurrenten. Een korte, feitelijke `llms.txt` (wat Wispel is, gratis, privacy,
iOS-first, geen ads) is goedkoop en corrigeert dat, zonder één regel productcode. Het crawler-besluit
is expliciet: **toestaan voor de marketingpagina's, blokkeren op `app.` en `api.`**.

**Acceptatiecriteria:**
1. ✅ `/privacy` beschrijft in gewone taal: welke AI-dienst, welke gegevens wel/niet, hoe je het
   uitzet. — sectie "AI bij Wispel" / "AI at Wispel", `messages/nl.json` + `en.json` (na "Waar staan
   de gegevens?"), zelfde structuur als de andere secties.
2. ✅ De sectie is er ook als AI nog uit staat — dan als "wij gebruiken op dit moment geen AI voor
   gezinsdata", en die zin wijzigt in dezelfde PR als de activatie. — huidige tekst begint met
   "Op dit moment gebruiken we geen AI voor gezinsdata."
3. ✅ Geen enkele pagina laadt een third-party AI-script (CSP-test). — `apps/web/lib/csp.ts`
   (uit `middleware.ts` getrokken zodat hij testbaar is zonder de Next-runtime) +
   `apps/web/lib/csp.test.ts`: asserteert dat `script-src` nooit een bekend AI-widget-domein
   bevat en nooit terugvalt op `'unsafe-inline'`. Geverifieerd op een live `next build` +
   `next start`: `script-src 'self' 'nonce-…' 'strict-dynamic' https://challenges.cloudflare.com`.
4. ⚠️ `robots.txt` en `llms.txt` staan live — **interim, pad-gebaseerd i.p.v. host-gebaseerd.**
   Marketing en dashboard draaien vandaag op **één** Next-app zonder host-split (O9 —
   `app.`/`api.`-subdomeinsplitsing is nog open, WS-INFRA). `apps/web/app/robots.ts` disallowed
   daarom `/api/` plus elke dashboard- en auth-route (`/*/vandaag`, `/*/gezin`, `/*/goedkeuren`,
   `/*/instellingen`, `/*/inzichten`, `/*/taken`, `/*/winkel`, `/*/login`, `/*/register`,
   `/*/uitnodiging`, `/*/wachtwoord-reset`, `/*/wachtwoord-vergeten`) en allowed de rest;
   `apps/web/app/sitemap.ts` bevat uitsluitend de publieke pagina's (`/`, `/privacy`,
   `/voorwaarden`, `/steun`) per taal. `apps/web/public/llms.txt` staat live op `/llms.txt`.
   **Nog open:** Cloudflare **AI Crawl Control** is een zone-instelling, geen code — moet apart
   gezet worden bij de infra-cutover (O9/WS-INFRA), dan pas is de host-gebaseerde blokkade op
   `app.`/`api.` echt.
5. ✅ Geen "AI" als feature-claim in hero, features of App Store-copy (R6). — `llms.txt` noemt AI
   uitsluitend in de zin "No AI in the product today", niet als marketingclaim.

Geverifieerd met een echte `next build` + `next start`: `/robots.txt`, `/sitemap.xml`, `/llms.txt`
en de CSP-header op `/nl` renderen zoals hierboven beschreven. Root proof lane
(`npm run typecheck && npm test`) groen: 25/215 (api) + 12/82 (web, +1 test file / +3 tests
t.o.v. voor deze stream).

**Docs to update:** `docs/taakhelden-privacy-minimum.md` §2 (subprocessors), ADR-0006 exit-criteria.

---

## 5. WS-AI-GUARD — veiligheidsvlag op Taakvraag-tekst

**Status: fase 1 geïmplementeerd.** Gate G3 geverifieerd tegen productiecode (niet alleen docs)
vóór de build — zie de correcties hieronder, gevonden door een architectuur-review vooraf.

**Doel:** de enige plek waar een kind vrije tekst het systeem in stuurt, is
`POST /tasks/proposals` (`title`, `note` — tiener-only, P4). Die tekst komt bij een ouder terecht.
Dat is user-generated content in de zin van richtlijn 1.2. We willen een filter dat de ouder
*helpt*, niet een censor die een tiener stilletjes blokkeert.

| In scope | Out of scope |
| --- | --- |
| Serverside vlag op `title` + `note` bij aanmaken | De taakvraag automatisch afwijzen |
| Vlag alleen zichtbaar voor de **ouder** in de queue | Het kind een waarschuwing tonen |
| Deterministische lijst (fase 1) | Notificatie naar externe instanties |
| Optioneel classifier-model (fase 2, na eval) | Sentiment/mood-analyse (R3 — verboden) |

**Ontwerp, fase 1 (T0 — gebouwd):**

- Migratie **0014** (`0014_proposal_review_flag.sql` + `.verify.sql` + `.meta.toml`):
  `ALTER TABLE task_proposals ADD COLUMN review_flag TEXT` (NULL = schoon; anders een korte
  code, vandaag alleen `language`).
- `apps/api/src/services/proposalScreen.ts` — pure functie `screenProposalText(title, note):
  "language" | null`, deterministische Nederlandse woordgrens-regex gericht op mogelijke
  veiligheidszorgen (zelfbeschadiging, geweld, seksueel, middelen), **geen** brede
  scheldwoordenfilter. `apps/api/test/proposalScreen.test.ts` dekt woordgrenzen (geen false
  positive op substrings als "hamster") en de bewuste uitzondering voor "seksualiteit".
- **Correctie op het oorspronkelijke ontwerp (architectuur-review vooraf):** er was maar één
  role-blinde `proposalView()` en twéé lekpaden, niet één — de `POST`-create-response (201, direct
  naar het indienende kind) én de `GET`-lijst. `TaskProposal.reviewFlag` is `.nullable().optional()`
  (niet alleen `.nullable()`): het veld ontbreekt volledig in kind-facing responses in plaats van
  `null` te tonen. `proposalView(row, includeReviewFlag: boolean)` is nu expliciet per call-site —
  `false` op de create-response en op `GET` voor `auth.role === "child"`, `true` op `GET` voor
  `auth.role === "parent"` en op de approve/decline-responses (altijd ouder-only via
  `requireParent(c, { full: true })`).
- Contract-regeneratie (`npm run openapi:generate`) bijgewerkt in dezelfde PR
  (`docs/openapi/taakhelden-core-v1.json`). De iOS Swift-contract-generator emit geen
  `TaskProposal`-type (Taakvraag is nog niet op het iOS-contractoppervlak, P4 blijft teen-only
  zonder iOS-koppeling) — geen Swift-wijziging nodig, geverifieerd met een echte
  `openapi:generate`-run, niet aangenomen.
- Nooit blokkeren: de taakvraag wordt altijd aangemaakt. De ouder ziet een neutrale markering
  (`Badge tone="neutral"` + hint-tekst, `apps/web/…/goedkeuren/ProposalQueue.tsx`), beslist zelf,
  en de bestaande vriendelijke afwijs-flow blijft ongewijzigd.

**Ontwerp, fase 2 (T2 — alleen ná eval):** dezelfde vlag, tweede signaal via
`@cf/meta/llama-guard-3-8b` in de Queue, ná de insert. **Voorwaarde:** de modelkaart noemt
Nederlands niet bij de ondersteunde talen (EN, FR, DE, HI, IT, PT, ES, TH). Zonder een Nederlandse
eval-set die aantoont dat het beter is dan de lijst, ship fase 2 niet. Prompt bevat uitsluitend
de tekst — geen naam, geen `childId`, geen `familyId`.

**Acceptatiecriteria:**
1. ✅ Een taakvraag met problematische tekst wordt **aangemaakt** en gemarkeerd, niet geweigerd. —
   `apps/api/test/proposals.test.ts` "markeert een taakvraag met zorgwekkende tekst, maar
   blokkeert 'm niet": 201, status `pending`, `review_flag = 'language'` in D1.
2. ✅ Het kind ziet nooit een vlag, een waarschuwing of een toonverandering (§3.7-test). — geen
   UI-wijziging op het kindpad; de kind-facing 201/GET-responses missen het veld volledig
   (getest, niet alleen `null`).
3. ✅ `reviewFlag` lekt niet naar een kindtoken (authz-test, cross-role én cross-family). —
   "ouder ziet de vlag in de lijst; kind nooit — ook niet als null" in `proposals.test.ts`.
4. ✅ De screening voegt geen meetbare latency toe aan `POST /tasks/proposals` (fase 1 is
   in-process en O(n) over de tekst; fase 2 is async). — pure functie, geen I/O, geen `await`.
5. Fase 2 mergt alleen met een eval-artefact dat winst t.o.v. fase 1 aantoont. — **nog niet
   gebouwd**, blijft T0 tot een Nederlandse eval er is.

**Dependencies:** `WS-PROPOSAL` (geshipt). Gate G3 — geverifieerd tegen productiecode (ledger-
formattering, `listPendingApproval`, stabiele Idempotency-Key, rate limits, invite-token-fix,
iOS PIN-hashing) vóór deze stream is gebouwd.

**Docs to update:** `docs/taakhelden-api-specificatie.md` (veld `reviewFlag`, ouder-only — gedaan),
`packages/shared/src/schemas/proposal.ts` (gedaan, zie diff).

---

## 6. WS-AI-INSIGHT — Gesprekskaart-samenvatting

**Doel:** de Gesprekskaart geeft ouders al de juiste cijfers (`repo/insights.ts`: earned, spent,
completionRate, streakDays, top-5 slippende taken). Wat ouders er níet uit halen is *wat je er
maandagavond mee zegt*. Eén warme Nederlandse alinea plus één concrete gesprekssuggestie is de
kleinste toevoeging met echte waarde — en het is precies de vorm die zonder namen kan.

| In scope | Out of scope |
| --- | --- |
| Wekelijkse tekst per gezin, ouder-facing | Alles wat een kind ziet (AI-2) |
| Opt-in per gezin, default **uit** | Default aan, of "even proberen"-nudge |
| Async generatie via bestaande cron | Synchrone generatie in het request |
| Deterministische Gesprekskaart als fallback | De bestaande kaart vervangen |
| Vergelijking van een kind **met zichzelf** over tijd | Vergelijking tussen kinderen (arch-regel: geen sibling-ranking) |

**De-identificatie — het hart van deze stream.** De prompt krijgt uitsluitend:

```jsonc
{
  "kinderen": [
    { "alias": "kind_1", "leeftijdsgroep": "mid", "verdiend": 120, "uitgegeven": 50,
      "afgerond": 9, "totaal": 12, "streak": 4,
      "slippendeCategorieen": ["huiswerk", "opruimen"] }
  ],
  "weekVerschilVorigeWeek": { "kind_1": +2 }
}
```

Wat er dus **niet** in zit: `displayName`, `childId`, `familyId`, geboortejaar, avatar-id, foto's,
en — bewust — ook geen taak**titels**. Taaktitels zijn ouder-geschreven vrije tekst en kunnen een
naam of adres bevatten; we sturen de `category` en `icon`, niet de titel. De namen worden pas
**client-side** teruggeplaatst in de gerenderde tekst via de aliassen.

**Schets:**

- `packages/shared`: `InsightsNarrative = { weekOf, text: z.string().max(500), suggestion: z.string().max(200), generatedAt }`;
  `WeeklyInsightsResponse.narrative: InsightsNarrative.nullable()`.
- Migratie **0015**: tabel `insight_narratives(family_id, week_of, text, suggestion, created_at,
  PRIMARY KEY (family_id, week_of))` + `families.ai_summary_enabled INTEGER NOT NULL DEFAULT 0`.
- Toggle via de bestaande `PATCH /families/me` (`FamilyPatchBody` uitbreiden) — ouder-only, en op
  iOS achter de parental gate. Uitzetten verwijdert de opgeslagen samenvattingen.
- Generatie in de bestaande cron (`5 0 * * *`), maandags, alleen voor gezinnen met de toggle aan
  en met activiteit die week. Resultaat naar `insight_narratives`. Nooit via de FamilyRoom-DO —
  dit raakt het ledger niet (AI-3).
- `GET /insights` leest de rij mee; ontbreekt hij, dan is `narrative: null` en rendert de web-app
  precies wat hij vandaag rendert.
- Kill switch: KV-key `ai:kill` → cron slaat generatie over, route serveert `null`.

**UI (ouder-dashboard, kalm register):** de tekst staat ín de Gesprekskaart, gelabeld als
automatisch gegenereerd, met een "klopt dit niet?"-actie die de kaart voor die week verbergt en
een teller ophoogt (zonder de tekst te loggen). Nooit op een kindtab, nooit in een push.

**Acceptatiecriteria:**
1. Met de toggle uit gaat er **nul** verkeer naar `c.env.AI` (test die de AI-binding mockt en
   asserteert dat hij niet is aangeroepen).
2. Geen enkele naam, id of taaktitel komt in de payload — test voedt een gezin met namen als
   "Fleur" en "Sem" en asserteert dat die strings niet in de prompt voorkomen.
3. Ongeldige of niet-parsebare modeloutput → `narrative: null` en een intacte Gesprekskaart;
   nooit een 5xx.
4. De tekst noemt geen enkel kind in vergelijking met een ander (eval-criterium + reviewregel).
5. Toon is positief en zonder schuldgevoel, ook bij een slechte week — `@dutch-child-copy` reviewt,
   ook al is de lezer een ouder.
6. Herhaalde `GET /insights` in dezelfde week levert dezelfde tekst (gecached, geen tweede call).
7. `ai:kill` op `1` → geen generatie, geen fout, alles blijft werken.
8. Toggle uit → opgeslagen samenvattingen zijn binnen dezelfde request verwijderd.

**Dependencies:** Gate G-AI. `WS-INSIGHTS` (geshipt).

**Docs to update:** `docs/taakhelden-api-specificatie.md` (`narrative`, `FamilyPatchBody`),
`docs/taakhelden-dpia-starter.md` §5b, `/privacy`.

---

## 7. WS-AI-ONDEVICE — dezelfde samenvatting, on-device (geparkeerd)

**Doel:** als dit werkt, verdwijnt de hele 5.1.2(i)-discussie voor de betreffende gebruikers:
er wordt niets gedeeld, dus er valt niets te disclosen.

Apple's Foundation Models framework draait een ~3B-model volledig op het toestel, gratis, offline,
maar vereist **iOS 26 + Apple Intelligence-hardware (iPhone 15 Pro / A17 Pro of nieuwer)**. Onze
minimum is iOS 17. Dat is vandaag een minderheid van de gezinnen en levert niets voor het
webdashboard — daarom pas ná `WS-AI-INSIGHT`, niet ervoor.

**Ontwerp als het opengaat:** iOS vraagt `SystemLanguageModel.availability`; beschikbaar →
genereer lokaal uit dezelfde gede-identificeerde payload en sla niets op de server op. Niet
beschikbaar → val terug op de serverversie (indien toggle aan) of de deterministische kaart.
Precies dezelfde Zod-vorm, zodat de UI één rendering-pad houdt.

**Blijft geparkeerd tot:** `WS-AI-INSIGHT` minimaal een kwartaal draait mét eval-historie, én
iOS 26-adoptie in onze installbase het rechtvaardigt.

---

## 8. Wat dit niet is

Geen enkele stream hierboven maakt Wispel "een AI-app". Er komt geen assistent, geen chat, geen
mascotte met een mening, en geen AI-badge op de website. Het maximale eindresultaat is: een ouder
leest maandag één rake alinea over zijn eigen gezin, en een tiener die iets ongepasts opschrijft
komt bij een ouder terecht in plaats van bij niemand. Als een voorstel meer belooft dan dat, hoort
het thuis in een nieuwe ADR — niet in deze catalogus.
