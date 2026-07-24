# Claude Code inrichten voor TaakHelden

Aanbeveling voor het uitrollen van álle Claude Code-features (subagents, skills,
slash-commands, hooks, MCP, settings) op deze repo — toegespitst op de zes harde
architectuurregels uit `CLAUDE.md`. Doel: Claude Code kan zelf de regels bewaken
in plaats van dat een reviewer ze steeds handmatig moet controleren.

Deze repo bevat nu een **werkende starter-kit** onder `.claude/`. Hieronder staat
wat er is, waarom, en wat je daarna nog kunt aanzetten.

---

## 0. Waar Claude Code uit bestaat (feature-kaart)

| Feature | Bestand / plek | Scope | In deze kit? |
|---|---|---|---|
| **Projectgeheugen** | `CLAUDE.md` | repo | ✅ bestond al |
| **Subagents** | `.claude/agents/*.md` | repo | ✅ 3 stuks |
| **Skills** | `.claude/skills/<naam>/SKILL.md` | repo | ✅ 1 (endpoint-scaffold) |
| **Slash-commands** | `.claude/commands/*.md` | repo | ✅ 3 stuks |
| **Hooks** | `.claude/settings.json` + `.claude/hooks/*` | repo | ✅ 2 guards |
| **Permissions** | `.claude/settings.json` | repo | ✅ allowlist |
| **Persoonlijke overrides** | `.claude/settings.local.json` (gitignored) | dev | ⚙️ zelf |
| **MCP-servers** | `.mcp.json` | repo | ✅ Cloudflare |
| **GitHub Action** | `.github/workflows/claude.yml` | CI | ✅ (secret zetten) |

Alles onder `.claude/` (behalve `settings.local.json`) staat in git en werkt dus
voor het hele team en in Claude Code op het web.

---

## 1. Projectgeheugen — `CLAUDE.md` (staat er al)

`CLAUDE.md` is al sterk: stack, de zes harde regels, taal/toon, commands, workflow.
Dat is de belangrijkste hefboom, dus laat 'm kort en scherp. Twee kleine tips:

- Verwijs vanuit `CLAUDE.md` naar de subagents/commands hieronder zodat nieuwe
  teamleden ze ontdekken.
- `@import`-syntax kan losse stukken inladen (bijv. `@docs/taakhelden-api-specificatie.md`)
  maar houd de root-`CLAUDE.md` klein — grote imports vreten context.

---

## 2. Subagents — `.claude/agents/`

Subagents draaien in een **eigen contextvenster** met een eigen toolset en systeem-
prompt. Ideaal voor terugkerende, afgebakende taken die je niet in de hoofdchat wilt
laten rondslingeren. Drie zijn er nu, elk gekoppeld aan een concrete regel:

- **`architecture-reviewer`** — controleert een diff tegen alle zes harde regels
  (geen SQL in routes, idempotentie, ledger-saldo, geen negatieve mechaniek, PII,
  Zod-validatie). Read-only. Roep aan vóór elke PR of via `/arch-check`.
- **`migration-writer`** — schrijft een nieuw genummerd D1-migratiebestand, wijzigt
  nooit een bestaande migratie, en draait de local dry-run.
- **`dutch-child-copy`** — genereert/reviewt kindgerichte NL-teksten volgens de
  positieve stijlgids (§3.7), zonder schuldgevoel-taal.
- **`ui-design-reviewer`** — controleert een UI-diff tegen het design system
  (`Design System/` + `globals.css`): token-adherentie (geen ruwe hex/px), juist
  register (dashboard/kind/teen), herbruik van primitives, en NL-copy in beide talen.
  Read-only. Roep aan via `/design-check`.

Aanroepen: `@architecture-reviewer kijk naar mijn wijzigingen` of laat Claude ze
automatisch kiezen op basis van de `description`. Model per agent instelbaar in de
frontmatter (`model: sonnet` voor snelle guards, zwaarder voor review).

**Kandidaten om later toe te voegen:** `api-contract-sync` (Zod ↔ API-spec bewaken),
`test-authz-writer` (verplichte authz-test per route genereren), `ios-swift-reviewer`.

---

## 3. Skills — `.claude/skills/`

Skills zijn herbruikbare, model-invoked "playbooks": Claude laadt de instructies
pas wanneer de taak past bij de `description` (progressive disclosure), dus ze
kosten geen context tot je ze nodig hebt. Ze mogen scripts en referentiebestanden
meenemen.

- **`endpoint-scaffold`** — zet een compleet nieuw endpoint op volgens de
  architectuur: Zod-schema in `packages/shared`, repo-functie met `familyId` als
  eerste argument, route die alleen repo-functies aanroept, plus de verplichte
  authz-test. Dit is precies de checklist uit `CLAUDE.md` → "Bij elke nieuwe route".
- **`design-system`** — bouwt/wijzigt user-facing UI volgens `Design System/`: juist
  register, token-utilities i.p.v. ruwe hex/px, en herbruik van de primitives in
  `apps/web/components/ui/`. Progressive disclosure via `references/tokens.md`.

Nieuwe skills maak je het makkelijkst met de meegeleverde **`skill-creator`**-skill.
Goede volgende kandidaten: `d1-migration` (met SQL-conventies + seed-patroon),
`family-room-do` (ledger-writes via de Durable Object serialiseren), `zod-error-codes`.

---

## 4. Slash-commands — `.claude/commands/`

Snelkoppelingen voor herhaalprompts; `$ARGUMENTS` vult je invoer in.

- **`/new-endpoint <resource>`** — kickt de endpoint-scaffold skill af voor een resource.
- **`/arch-check`** — draait de architecture-reviewer op de huidige diff.
- **`/new-migration <beschrijving>`** — nieuw genummerd migratiebestand + dry-run.
- **`/design-check`** — draait de ui-design-reviewer op de huidige UI-diff.

Commands mogen zelf Bash uitvoeren (via `!`-prefix) en bestanden inladen (`@`), dus
je kunt er ook een `/ci-local` van maken die typecheck + test + migratie-dry-run
achter elkaar draait — precies wat CI doet.

---

## 5. Hooks — `.claude/settings.json` + `.claude/hooks/`

Hooks zijn deterministische shell-commando's die Claude Code rond tool-aanroepen
draait. Anders dan een prompt-instructie zijn ze **niet optioneel** — perfect om
harde regels af te dwingen. Twee zijn er nu, als `node`-scripts (Node is toch al
een dependency):

- **`block-migration-edit.mjs`** (PreToolUse op `Edit`/`Write`) — **blokkeert** elke
  wijziging aan een bestaande migratie in `apps/api/migrations/`. Dwingt de regel
  "nooit bestaande migraties wijzigen" af; een nieuw genummerd bestand mag gewoon.
- **`guard-route-sql.mjs`** (PostToolUse op `Edit`/`Write`) — **waarschuwt** wanneer
  een bestand in `apps/api/src/routes/` ruwe SQL bevat (`.prepare(`, `SELECT`, …).
  Dwingt regel 1 af: routes praten nooit rechtstreeks met D1.

Blokkerende hook = exit code 2 (Claude ziet de stderr en corrigeert). Meer ideeën:
- PostToolUse die `npm run typecheck -w <workspace>` draait op het gewijzigde pakket.
- PreToolUse die `git`-push naar `main` blokkeert (workflow: altijd via PR).
- Een hook die waarschuwt bij `console.log` met namen/foto-URLs (privacy-regel 5).

---

## 6. MCP-servers — `.mcp.json` (in deze kit)

De **GitHub MCP-server** is in deze omgeving al beschikbaar (PR's, issues, reviews).
Deze kit voegt `.mcp.json` toe met de gedeelde **Cloudflare MCP-servers** (via
`mcp-remote`, OAuth bij eerste gebruik — dus géén tokens in de repo):

- **`cloudflare-observability`** — Worker-logs en analytics opvragen tijdens debugging.
- **`cloudflare-bindings`** — bindings inspecteren en D1 queryen zonder de
  dashboard-context te verliezen.

Bij het eerste gebruik opent `mcp-remote` een OAuth-login in de browser; het token wordt
lokaal opgeslagen, niet in git. Zie `developers.cloudflare.com/agents/model-context-protocol`.

**Later toe te voegen:** een **Playwright/Puppeteer MCP** voor het web-dashboard
(`apps/web`) om UI-flows te laten testen. Zet eventuele geheime tokens in
`.claude/settings.local.json` (gitignored), nooit in `.mcp.json`.

---

## 7. Claude Code in CI — `.github/workflows/claude.yml` (in deze kit)

Naast de bestaande `ci.yml` (typecheck/test/migratie-dry-run) voegt deze kit de
**Claude Code GitHub Action** toe (`anthropics/claude-code-action`, vastgepind op een
commit-SHA i.p.v. de bewegende `@v1`-tag — supply-chain):

- `@claude`-mentions in issues/PR-comments laten Claude fixes voorstellen of vragen
  beantwoorden. De agents/skills uit `.claude/` — o.a. `architecture-reviewer` — zijn dan
  beschikbaar.
- Draait **alleen** op een expliciete `@claude`-mention van een vertrouwde gebruiker
  (`author_association` OWNER/MEMBER/COLLABORATOR), geen auto-run bij PR-open — zodat er
  geen rode CI ontstaat en niemand van buiten de action met onze secrets kan aftrappen.

**Actie vereist:** zet `ANTHROPIC_API_KEY` als **repo-secret** (Settings → Secrets and
variables → Actions). Er staat bewust geen secret in de repo. De scope is klein gehouden
(`issue_comment`, `pull_request_review_comment`, `issues`), en de bestaande `ci.yml` blijft
de bron van waarheid voor groen/rood.

---

## 8. Externe skills adopteren (veilig)

Er zijn grote publieke skill-bibliotheken (bijv. `github.com/alirezarezvani/claude-skills`,
362 skills over 13 tools). Handig voor inspiratie, maar **kopieer nooit blind** — een
skill is uitvoerbare instructie + soms scripts, dus het is een supply-chain-oppervlak.

Werkwijze bij het overnemen van een externe skill:
1. **Lees de volledige `SKILL.md` + alle `scripts/`** vóór installatie. Let op verborgen
   instructies (prompt-injection), `curl | sh`, exfiltratie van env-vars/secrets, of
   commando's die buiten de repo schrijven.
2. **Neem alleen het patroon over, niet de bulk.** Voor TaakHelden is 95% van zo'n
   bibliotheek irrelevant (marketing, C-suite, finance). Pluk de techniek en herschrijf
   'm naar onze conventies en taal.
3. **Pin geen externe scripts als dependency** — onze hooks zijn bewust zero-dependency
   Node. Houd dat zo.
4. **Toets tegen onze regels:** een overgenomen skill mag de zes harde regels nooit
   ondermijnen (geen SQL-in-routes-shortcuts, geen saldoveld-patronen, enz.).

Patronen die we uit die bibliotheek hebben overgenomen en op onze kit hebben toegepast:
- **Progressive disclosure** — `endpoint-scaffold` heeft nu een aparte
  `references/templates.md` die pas geladen wordt bij het scaffolden.
- **Verificatie-/anti-hallucinatie-gate** — de `architecture-reviewer` en de
  scaffold-checklist eisen nu `bestand:regelnummer`-bewijs en gegrepte bevestiging in
  plaats van aannames.
- **Adversariële review** — de reviewer neemt expliciet de rol van kritische senior aan.

Een eigen `skill-security-auditor`-achtige subagent (die een externe skill scant vóór
adoptie) is een goede volgende toevoeging als het team vaker externe skills gaat halen.

---

## 9. Uitrol in drie stappen

1. **Nu (in deze PR):** `.claude/` starter-kit — agents, skill, commands, hooks,
   permissions. Team pullt en heeft direct de guards + scaffolds.
2. **Sprint erna:** `.mcp.json` met Cloudflare MCP; extra skills (`d1-migration`,
   `family-room-do`); `test-authz-writer`-agent.
3. **Later:** Claude Code GitHub Action voor PR-review/`@claude`; hook die
   typecheck per workspace draait; iOS-review-agent.

Begin klein, meet of de guards echt helpen (blokkeren ze de juiste dingen?), en
breid uit. De grootste winst zit in de hooks en de `architecture-reviewer`: die
vangen precies de fouten die deze codebase duur maken.
