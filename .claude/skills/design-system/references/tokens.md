# Token- en component-referentie

Snelle referentie bij het bouwen. De volledige uitleg + rationale staat in
`Design System/readme.md`; de canonieke waarden in `apps/web/app/globals.css`
(gespiegeld in `Design System/tokens/*.css`). Wijzig je een token, wijzig het op
**beide** plekken identiek.

## Tailwind-utilities → CSS-variabele
De mapping staat in `apps/web/tailwind.config.ts`. Belangrijkste:

| Utility | Variabele | Waarde |
|---|---|---|
| `bg-bg` / `bg-surface` | `--color-bg` / `--color-surface` | `#ffffff` / `#f6f7f9` |
| `border-border` | `--color-border` | `#e5e8ec` |
| `text-text` / `text-muted` | `--color-text` / `--color-text-muted` | `#1b1f24` / `#5a6470` |
| `bg-accent` / `hover:bg-accent-hover` / `text-accent-fg` | `--color-accent…` | teal `#0e9f8e` |
| `text-danger` / `bg-danger-bg` | `--color-danger…` | `#b00020` / `#fdecef` |
| `text-success` / `bg-success-bg` | `--color-success…` | `#1f9254` / `#eaf7ef` |
| `bg-kid-coral` / `-turquoise` / `-yellow` / `-cream` (+ `-soft`) | `--kid-*` | inferred |
| `bg-teen-navy` / `-navy-surface` / `text-teen-mint` | `--teen-*` | inferred |
| `rounded-sm/DEFAULT/lg/xl/full` | `--radius-*` | 6 / 10 / 16 / 24 / pill px |
| `shadow-sm/md/kid` | `--shadow-*` | vlak / medium / warm coral |
| `font-sans` / `font-rounded` | `--font-sans` / `--font-rounded` | system / Fredoka |
| type `text-xs…text-4xl`, `font-medium/semibold/bold` | `--text-*` / `--weight-*` | 4px-schaal |
| spacing `p-4`, `gap-6`, … | `--space-*` | 4px-basis |

**Kid/teen-paletten zijn inferred/placeholder** (vertaald uit productvoorstel §4.1),
niet brand-final. Zie de vlaggen in `globals.css`.

## Web-primitives (`apps/web/components/ui/`)
Importeer via `../…/components/ui` (barrel `index.ts`):
- `Button` — variants `primary`/`secondary`/`ghost`/`danger`, sizes `sm`/`md`/`lg`.
- `Card` — dashboard-surface (wit, border, `shadow-sm`), `padded` prop.
- `Field` + `Input` — label + input met focus/`invalid`-state.
- `Badge` — tones `neutral`/`accent`/`success`/`danger` (pill).
- `Alert` — tones `danger`/`success`.
- `ProgressBar` — `value`/`max`/`label`, tone `accent`/`kid`.
- `RewardCard` / `PointsBadge` / `StreakBadge` — warme kid-varianten (gebruikt in
  Winkel/Vandaag om te tonen wat het kind ziet).

Bron-componenten (JSX, inline styles) staan in `Design System/components/`; port naar
Tailwind-token-utilities zoals de bestaande primitives, niet 1-op-1 kopiëren.

## UI-kits als layout-referentie
`Design System/ui_kits/parent-dashboard/` bevat click-through mockups van Login,
Vandaag, Goedkeuren, Taken, Winkel, Inzichten. `ui_kits/kid-app/` idem voor de iOS-
schermen. Gebruik ze als layout-referentie, niet als importeerbare code.

## Bestaande secties
De dashboard-secties (`vandaag`, `goedkeuren`, `taken`, `winkel`) zijn client-
componenten die live data laden via `lib/api/client.ts`. `inzichten` is nog een
`SectionStub`. Gebruik bij het aanpassen de primitives i.p.v. ad-hoc `<button>`/
`<input>`-markup, maar houd de bestaande data-/authz-logica intact.
