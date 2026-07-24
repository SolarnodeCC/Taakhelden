---
name: market-research-templates
description: Output templates for the TaakHelden market-research skill — competitor, community, review, web-search, on-demand query, market pulse, backlog annotation, and win/loss formats. Load alongside market-research.md when producing a research deliverable.
---
# Market Research Output Templates (TaakHelden)
# OWNER: Product Owner

Companion to `.claude/skills/market-research.md` (methodology + governance). Templates here.
Every filled template must cite public sources (URL + date); never fabricate data, and never
include any child's data.

---

## Competitor app / website
```
CONCURRENT: [Naam]

Recente activiteit (laatste 3 maanden):
- [Release]: [wat het oplost] — bron: [URL, datum]
- [Prijswijziging]: [richting + rationale] — bron: [URL, datum]

Feature-vergelijking vs. TaakHelden:
| Feature | Concurrent | TaakHelden |
|---------|------------|------------|
| [Feature] | [capability] | [capability] |

Positionering: [hun positionering in 1–2 zinnen]
TaakHelden-onderscheid: [voordeel] — [waarom relevant voor NL-gezinnen]
```

## Parenting communities
```
COMMUNITY-ONDERZOEK: [Onderwerp/community]

Top pijnpunten (ouders):
1. [Pijn]: [geanonimiseerd citaat] ([community], [datum]) | Frequentie: [Hoog/Mid/Laag]

Feature-verzoeken (op frequentie):
1. [Verzoek]: [citaat] ([N] vermeldingen) | Waarom: [waarde] | TaakHelden heeft dit? [J/N/Deels]

Segment-inzichten: [gezinnen met meerdere kinderen / jonge kinderen / tieners ...]
```

## App-store & review platforms
```
REVIEW-ONDERZOEK: [Concurrent]

Sentiment: [store] [X]/5 ([N] reviews, [periode]) — bron: [URL, datum]
Top pluspunten (door ouders genoemd): 1. [pro] — [N] — "[citaat]"
Top minpunten: 1. [con] — [N] — "[citaat]" | TaakHelden-positie: [...]
Redenen om te switchen: [citaat] | TaakHelden-voordeel: [...]
```

## Web search & trends
```
MARKTONDERZOEK: [Zoekonderwerp]

Bevindingen: - [bevinding]: [bron: URL, datum]
Trends (NL/EU family gamification): - [trend]: [richting] | [impact op positionering]
Privacyverwachtingen kinderen: - [inzicht]: [bron]
Bronnen: - [bron]: [URL, datum]
```

## On-demand query response
```
MARKTVRAAG: [Onderwerp]

Bevindingen: - [bevinding]: [bron] | "[citaat]"
Vraag vanuit ouders: - [signaal]: [frequentie] | [segment]
Positioneringskans TaakHelden: - [optie]: [voordeel] | [afweging]
Backlog-context: bevestigt [STORY-ID] | stelt voor [nieuw item] | prioriteit [advies]
Bronnen: - [bron]: [URL, datum]
```

## Market pulse
```
# MARKT-PULSE (week van [datum])

## Concurrent-activiteit
- [Concurrent] lanceerde/prijsde: [detail] — implicatie: [...] (bron)

## Sentiment ouders
- Meest gestelde vraag: "[V]" — [N] vermeldingen | [segment]

## Trends
- [Trend]: [richting] | [actie voor TaakHelden?]

## Aggregatie pijnpunten
1. [Pijn]: [frequentie] | bevestigt [STORY-ID]

## Backlog-aanbevelingen
- Prioriteer [STORY-ID] op basis van [bevinding]
```

## Backlog annotation
```
MARKT-ONDERZOEK: [Bevinding]
- Bron: [platform, URL, datum] | Frequentie: [Hoog/Mid/Laag], [N] vermeldingen
- Segment: [ouders / gezin met meerdere kinderen / ...]
- Signaal: [gedrag concurrent + impact]
- Validatie: pakt [pijn] aan die [N] ouders noemen
```

## Win/loss analysis
```
WIN/LOSS: [Segment]

Waarom ouders TaakHelden kiezen: 1. [reden]: [frequentie] — "[citaat]"
Waarom ouders wegblijven/switchen: 1. [reden]: [frequentie] — "[citaat]" | Mitigatie: [...]
Kwetsbaarheid: [concurrent] wint op [capability] — counter via [strategie]
```
