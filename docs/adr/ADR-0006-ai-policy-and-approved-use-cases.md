# ADR-0006: AI bij Wispel — beleid, toegestane use cases en App Store-conformiteit

- Status: **voorgesteld (PO, 2026-08-06)** — vereist DPIA-aanvulling (§7) en juridische toets vóór de eerste regel AI-productcode
- Date: 2026-08-06
- Affects: product canon, `apps/api`, `apps/ios`, `apps/web`, `/privacy`, App Store-metadata, DPIA, `.claude/` agent-lane
- Related: [ADR-0005](./ADR-0005-wispel-privacy-free-donations.md) · [`wispel-ai-workstreams.md`](../wispel-ai-workstreams.md) · [`taakhelden-privacy-minimum.md`](../taakhelden-privacy-minimum.md) §6 · [`taakhelden-dpia-starter.md`](../taakhelden-dpia-starter.md) §5b · [`taakhelden-ios-bouwvoorstel.md`](../taakhelden-ios-bouwvoorstel.md) §14
- Supersedes: niets. Vult ADR-0005 aan; alle daar vastgelegde principes blijven leidend.

## Context

Wispel heeft **vandaag nul AI in het product**: geen LLM-calls, geen embeddings, geen RAG
(`.claude/skills/ai-engineering.md`, `.claude/skills/ai-strategy.md`). Tegelijk zijn er drie
krachten die om een expliciet besluit vragen:

1. **Markt.** De concurrentiescorecard (`docs/market-research/competitor-scorecard-2026-08.md`)
   laat zien dat "AI assistant" in 2026 een expliciete claim is bij meerdere spelers — IAFT
   SmartFamily verkoopt een "Frankie"-copiloot met AI-planning én **mood tracking**, en dat
   voor $29,99. Wij zijn gratis en privacy-first; wij winnen dit niet met feature-pariteit.
2. **Ons eigen anti-goal.** Het build plan noemt "feature laundry (AI/Alexa)" letterlijk als
   anti-goal voor marketing (`wispel-build-plan-workstreams.md` §7). Zonder beleid glijdt dat
   alsnog binnen via een "kleine slimme feature".
3. **Regelgeving is bewegend doel.** Apple heeft op 13-11-2025 richtlijn **5.1.2(i)** aangescherpt:
   *"You must clearly disclose where personal data will be shared with third parties, **including
   with third-party AI**, and obtain explicit permission before doing so."* Op 08-06-2026 volgde
   opnieuw een update met nieuwe taal rond safety en AI. Wij zijn functioneel een kind-primaire
   app (§14.1 iOS-bouwvoorstel), dus elke AI-keuze raakt direct onze store-positionering.

Zonder besluit is de default onduidelijk, en onduidelijkheid in een kinderapp is duur.

## Besluit

### 1. Het uitgangspunt

> **AI is bij Wispel een middel voor ouders en voor veiligheid — nooit een gesprekspartner
> voor een kind, en nooit een verkoopargument.**

Vier regels, hard:

| # | Regel |
| --- | --- |
| **AI-1** | **Geen model raakt kind-PII.** Geen naam, e-mail, foto, geboortejaar, avatar-id of user-id in een prompt. Aggregaten en pseudoniemen (`kind_1`) wel. |
| **AI-2** | **Geen vrije AI-tekst rechtstreeks naar een kind.** Kindgerichte copy blijft deterministisch/templated (stijlgids §3.7). Geen chat, geen huiswerkhulp-bot, geen AI-notificaties. |
| **AI-3** | **AI heeft nooit autoriteit.** AI-output is advies-tekst of een vlag voor een ouder. Nooit een ledger-write, nooit auto-goedkeuren, nooit auto-afwijzen, nooit een punt af- of bijboeken (arch-regels 3 en 4). |
| **AI-4** | **Alleen Workers AI (`c.env.AI`) in het productpad.** Geen externe LLM-API's (OpenAI/Anthropic/Google/…) vanuit Worker, web of iOS. Toolchain-uitzondering: zie §4. |

Aanvullend, uit ADR-0005 afgeleid: **AI wordt nooit een donatie-perk.** Kernfuncties zijn gratis;
een AI-feature mag dus nooit achter donaties. Dat is meteen een ontwerpbeperking: alles wat we
bouwen moet betaalbaar zijn bij duizenden gezinnen (§6).

### 2. De ladder — kies altijd de laagste trede die werkt

| Trede | Wat | Wanneer | Privacy-kosten |
| --- | --- | --- | --- |
| **T0 — geen model** | Deterministische heuristiek, tabel, catalogus, wordlist | **Default.** Als T0 het werk doet, stopt het hier | Nul |
| **T1 — on-device** | Apple Foundation Models (iOS 26+, iPhone 15 Pro+) | Ouder-tekst op nieuwe toestellen; altijd met T0-fallback | Nul — data verlaat het toestel niet |
| **T2 — Workers AI, gede-identificeerd** | `c.env.AI` op aggregaten/pseudoniemen, async, ouder-facing | Als T0 aantoonbaar tekortschiet | Subprocessor-disclosure + opt-in vereist |
| **T3 — extern model over gezinsdata** | — | **Nooit** | n.v.t. |

De Gesprekskaart (`WS-INSIGHTS`, PR #85) is het bewijs dat T0 ver komt: weekcijfers, streaks en
"slippende taken" zonder één modelaanroep.

### 3. Goedgekeurde use cases

Volledige scope, AC's en bouwvolgorde staan in [`wispel-ai-workstreams.md`](../wispel-ai-workstreams.md).

| ID | Use case | Trede | Voor wie | Waarom dit past |
| --- | --- | --- | --- | --- |
| **WS-AI-DEVLANE** | AI in de toolchain, niet in het product (copy-concepten, i18n-pariteit, testdata, code-review-agents) | n.v.t. (buiten productpad) | Team | Nul gebruikersdata, nul App Store-impact, directe waarde. Start nu. |
| **WS-AI-WEBPOLICY** | AI-beleid voor wispel.cc: crawler-policy, `llms.txt`, CSP zonder AI-widgets, `/privacy` §AI | T0 | Publiek | Dit *is* het 5.1.2(i)-artefact. Blokkeert niets en dekt Gate G1. |
| **WS-AI-GUARD** | Veiligheidsvlag op Taakvraag-tekst (tiener → ouder) | T0, dan T2 na eval | Ouder | Enige plek met vrije kindtekst; adresseert richtlijn 1.2 (UGC). |
| **WS-AI-INSIGHT** | Gesprekskaart-samenvatting: warme NL-alinea + één gesprekssuggestie uit weekcijfers | T2 | Ouder (opt-in, default **uit**) | Aggregaten, geen namen, ±1 call per gezin per week, altijd deterministische fallback. |
| **WS-AI-ONDEVICE** | Zelfde samenvatting volledig on-device op iOS 26+ | T1 | Ouder | Geen datadeling → 5.1.2(i) niet eens van toepassing. **Geparkeerd** tot WS-AI-INSIGHT live is. |

### 4. Expliciet afgewezen

| ID | Afgewezen | Reden |
| --- | --- | --- |
| **R1** | **AI-chatbot / huiswerkhulp voor kinderen** | Richtlijn 4.7.1 eist filtering, meldmechanisme én blokkeren van gebruikers; 4.7.5 eist age-gating op basis van geverifieerde/opgegeven leeftijd. Dat bouwen we niet goed genoeg voor een 8-jarige. Daarbij: onvoorspelbare toon botst met §3.7, de kosten zijn onbegrensd bij een gratis product, en de leeftijdsclassificatie loopt op — wat onze familie-first listing (§14.1) ondermijnt. Botst met AI-2. |
| **R2** | **Vision-AI op kinderfoto's** (moderatie of "is de klus gedaan?") | Botst frontaal met AI-1 en arch-regel 5. Foto's zijn al gezins-gescoped, EXIF-gestript en 30 dagen houdbaar, en alleen de ouder ziet ze. Auto-goedkeuren botst bovendien met AI-3 en riskeert een kind onterecht afwijzen (negatieve mechaniek). |
| **R3** | **Emotie-, stemmings- of gedragsanalyse van kinderen** (de "mood tracking"-feature van de concurrent) | Profilering van minderjarigen. Geen rechtsgrond die wij willen verdedigen, geen product-noodzaak, en het maakt van Wispel een observatie-instrument in plaats van een gezinsafspraak. Hard nee, ook met ouder-toestemming. |
| **R4** | **Externe LLM-API's in het productpad** | Extra subprocessor buiten onze EU-first stack, extra 5.1.2(i)-disclosure, extra kosten, en modelaanbieders die (anders dan Cloudflare voor Workers AI) niet contractueel garanderen niet op onze content te trainen. Botst met AI-4. |
| **R5** | **AI-gegenereerde tekst in kindnotificaties of kind-UI** | Botst met AI-2. De positieve stijlgids is een belofte, geen sampling-parameter. |
| **R6** | **"AI" als marketingclaim op wispel.cc of in App Store-metadata** | Het gedeclareerde anti-goal "feature laundry" (§7 build plan). Wij verkopen rust en privacy, niet modelnamen. |

Herzien van R1–R5 vereist een nieuwe ADR, niet een PR-discussie.

### 5. App Store-conformiteit (iOS-regels)

Wispel zit **niet** in de Kids Category (bewuste non-keuze, §14.3 iOS-bouwvoorstel), maar is
functioneel kind-primair. We houden ons daarom aan de Kids-eisen alsof we er wél in zitten.

| Richtlijn | Eis | Wat wij doen |
| --- | --- | --- |
| **5.1.2(i)** Data Use and Sharing | Expliciet disclosen waar persoonsgegevens met derden — *inclusief third-party AI* — worden gedeeld, en vooraf toestemming vragen | `/privacy` krijgt een sectie **"AI bij Wispel"**: welke dienst (Cloudflare Workers AI), welke gegevens (weekaggregaten, pseudoniemen), welke niet (namen, foto's, vrije tekst van kinderen). Subprocessorlijst uitgebreid. Ouder-toggle **default uit**; zonder toggle geen call. App Store privacy-labels bijwerken. |
| **1.3** Kids Category | Geen links/aankopen buiten een parental gate; geen PII of device-info naar derden; geen third-party analytics/ads | AI-instellingen en -toestemming staan uitsluitend achter de **parental gate** (§5.3), nooit op een kindtab — zelfde regel als donaties (ADR-0005). Geen kind-identificerende data naar Workers AI. |
| **5.1.4** Kids | Extra zorg bij kinderdata; privacyverklaring verplicht; COPPA/AVG | AI-1 + DPIA-aanvulling §5b. Rechtsgrond blijft ouderlijke toestemming (AVG art. 8), nu expliciet per verwerkingsdoel. |
| **1.2** User-Generated Content | Filtermethode, meldmechanisme, blokkeren, bereikbare contactinfo | Taakvraag is de enige UGC-surface en is gezins-gescoped. `WS-AI-GUARD` levert het filter; de ouder is het meldkanaal én de beslisser; contactadres staat op `/privacy`. |
| **4.7 / 4.7.1 / 4.7.5** Chatbots | Chatbot-software vereist filtering, melden, blokkeren én leeftijdsbeperking | **Wij shippen geen chatbot** (R1). Dit is de belangrijkste reden waarom niet. |
| **2.3.6** Age rating | Eerlijk antwoorden op de vragenlijst | AI-features worden bij submit expliciet meegewogen in App Store Connect. Zonder chat/UGC-naar-buiten blijft de familie-first rating houdbaar; **verifiëren bij elke submit**, want de vragenlijst wijzigt. |
| **3.x / ADR-0005** | Geen betaalmuur op kernfuncties | AI-features zijn gratis of ze bestaan niet. Nooit een donatie-perk. |

**Consequentie voor de listing:** de app-beschrijving vermeldt AI niet als feature. Wél komt in
`/privacy` en in de App Store-privacylabels te staan wat er (eventueel) gebeurt. Dat is precies
andersom dan de markt het doet, en het is de bedoeling.

### 6. Kosten- en latency-budget

Wispel is gratis en leeft van donaties. Een AI-feature die meeschaalt met kindgebruik is
daarmee per definitie ongeschikt — dat is een tweede, onafhankelijke reden waarom R1 afvalt.

| Feature | Callvolume | Ruwe kosten |
| --- | --- | --- |
| **WS-AI-INSIGHT** | ±1 call per gezin per **week**, gegenereerd door de bestaande cron, gecached op `(familyId, weekOf)` | ~1.200 input- + ~350 outputtokens ≈ **26 neurons** per gezin-week met een 8B-klasse model. Bij $0,011 / 1.000 neurons: **~$0,0003 per gezin per week** → 1.000 gezinnen ≈ **$1,25 per maand**. Binnen de gratis 10.000 neurons/dag past ruwweg **380 gezinnen per dag**; door de cron over de week te spreiden ~2.500 gezinnen zonder betaald plan. |
| **WS-AI-GUARD** | ±1 call per taakvraag; taakvragen zijn zeldzaam (tiener-only, P4) | Verwaarloosbaar; classifier-tokens zijn goedkoop. |
| **R1 chatbot** | Onbegrensd, schaalt met kindgebruik | Niet budgetteerbaar bij gratis. |

**Latency.** Workers AI is 2–8 s. Geen enkele AI-call mag in een request-response van een kind of
ouder zitten. Alles loopt via de bestaande **cron** of een **Queue**; de UI toont de deterministische
versie totdat het resultaat er is.

### 7. Gevolgen voor privacy en AVG

| Artefact | Wijziging |
| --- | --- |
| `docs/taakhelden-privacy-minimum.md` | Nieuwe §6 "AI-verwerking" — regels + subprocessorregel |
| `docs/taakhelden-dpia-starter.md` | Nieuwe §5b — AI als aanvullende verwerkingsactiviteit, inclusief risicotabel en open acties |
| `/privacy` (apps/web) | Sectie "AI bij Wispel" (NL + EN), subprocessorrij Cloudflare Workers AI |
| App Store privacy-labels | Bijwerken vóór de eerste submit ná activatie van WS-AI-INSIGHT |
| Toestemming | Aparte, intrekbare ouder-toggle per gezin. Intrekken wist de gecachte samenvattingen. |

**Bewaartermijn.** Prompts en outputs worden niet door Cloudflare bewaard tenzij wij ze zelf naar
R2/KV/D1 schrijven. Wij bewaren uitsluitend de **gegenereerde samenvatting** in D1/KV, maximaal
**zolang de betreffende week zichtbaar is** en niet langer dan de bestaande insights-historie.
De prompt zelf loggen we nooit.

**Datalokatie — bekende beperking.** D1 staat op `weur` en R2 op jurisdiction `eu`. Cloudflare
documenteert voor Workers AI wél dat klantcontent niet voor training wordt gebruikt en niet met
andere klanten wordt gedeeld, maar **geen** EU-only inferentieregio. Daarom is AI-1 (geen kind-PII,
alleen aggregaten en pseudoniemen) niet alleen een privacy-principe maar de **technische
compensatie** voor het ontbreken van regio-garantie. Dit staat expliciet in de DPIA-aanvulling.

### 8. Betrouwbaarheid — wat "betrouwbaar" hier concreet betekent

Elke AI-call in het productpad voldoet aan alle zeven, of hij ship niet:

1. **Zod-gevalideerde output** uit `packages/shared`; geen ruwe modeltekst rendert ooit.
2. **Deterministische fallback** die altijd bestaat en zonder AI een compleet scherm oplevert.
3. **Timeout (≤ 5 s) + max één retry**, daarna stil degraderen — nooit een 5xx richting gebruiker.
4. **Kill switch**: één KV-flag zet alle AI-features globaal uit zonder deploy; plus een per-gezin toggle.
5. **Eval-set** van minimaal 20 Nederlandse gevallen, met vastgelegde before/after op bruikbaarheid
   en format-validiteit. Geen eval-bewijs → geen merge.
6. **Logging zonder PII**: alleen tellers en vlaggen; nooit prompt, naam of foto-URL.
7. **Promptinjectie**: alle kind-/oudertekst is untrusted input, staat nooit in de system-prompt, en
   kan nooit data van een ander gezin bereiken (repo-laag blijft de grens).

**Taalrisico, expliciet.** `@cf/meta/llama-guard-3-8b` documenteert ondersteuning voor Engels,
Frans, Duits, Hindi, Italiaans, Portugees, Spaans en Thai — **Nederlands staat er niet bij**.
Een veiligheidsclassifier die onze taal niet officieel dekt is geen veiligheidsgarantie. Daarom
start `WS-AI-GUARD` op T0 (deterministische lijst) en komt het model er alleen bij als een
Nederlandse eval-set het rechtvaardigt. Zelfde discipline geldt voor de samenvatting: modelkeuze
is een **eval-uitkomst**, geen ontwerpaanname.

## Alternatieven overwogen

| Alternatief | Waarom niet |
| --- | --- |
| **Helemaal geen AI, ook niet in de toolchain** | Verspilt gratis winst (copy-concepten, i18n-pariteit) zonder enig gebruikersrisico. Te streng. |
| **Pariteit met "Frankie"-achtige assistenten** | Kost onze belangrijkste differentiator (privacy) om tweede te worden op een feature die wij niet kunnen betalen. |
| **AI eerst on-device (T1) bouwen** | Vereist iOS 26 + iPhone 15 Pro of nieuwer, terwijl onze minimum iOS 17 is. Levert vandaag een feature voor een minderheid en niets voor web. Daarom T2 eerst, T1 als upgrade. |
| **AI-samenvatting default aan** | Botst met 5.1.2(i) ("obtain explicit permission") en met privacy-first als merkbelofte. Opt-in kost conversie en is het waard. |

## Non-goals

- Implementeren van welke AI-feature dan ook in deze ADR (dat is `wispel-ai-workstreams.md`).
- Model- of promptkeuze vastleggen — dat is een eval-uitkomst.
- Vectorize, RAG, embeddings of AI Gateway introduceren. Buiten scope tot een aparte ADR.
- De donatie-, merk- of infra-besluiten uit ADR-0005 heropenen.

## Exit-criteria

- [ ] PO + Security tekenen §1 (AI-1 t/m AI-4) en §4 (R1–R6)
- [ ] DPIA §5b afgerond en juridisch getoetst — **blokkeert alle T2-code**
- [ ] `/privacy` sectie "AI bij Wispel" live in NL + EN — **blokkeert activatie**, niet ontwikkeling
- [ ] Ouder-toggle (default uit) + globale kill switch aantoonbaar werkend, met authz-test
- [ ] Nederlandse eval-set vastgelegd met before/after per AI-feature
- [ ] App Store privacy-labels en de age-rating-vragenlijst opnieuw beoordeeld vóór de eerstvolgende submit
