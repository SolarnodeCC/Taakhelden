# Wispel brand sheet v1

**Status:** Shipping brand foundation (WS-BRAND, 2026-07-30).  
**Token owner (O17):** one editor for `apps/web/app/globals.css` ↔ `Design System/tokens/*` ↔ `THPalettes` (iOS).

## Name & domain
| | |
| --- | --- |
| Product name | **Wispel** (never “wispel.cc” in chrome) |
| Domain | **wispel.cc** |
| Pronunciation | *wis-pel* (Dutch “wispelen” = fidget / playful motion) |

## Promises (NL / EN)
| Pillar | NL | EN |
| --- | --- | --- |
| Parent promise (O6) | Huiswerk en klusjes die wél lukken | Homework and chores that actually stick |
| Privacy (O5) | Privacy first — geen ads, geen kindtracking, EU-first hosting | Privacy first — no ads, no child tracking, EU-first hosting |
| Free (O5) | Gratis voor gezinnen; optionele steun alleen voor ouders | Free for families; optional support parent-only |

## Vocabulary (O1)
Ster / Star — celebration “…een ster vandaag!” / tab **Mijn Ster**. No Held/Hero.

## Palette (O2) — locked shipping hex
Reject cream+#blue ChoreHero twin. Kinship: kid turquoise = parent accent.

| Register | Role | Hex |
| --- | --- | --- |
| Parent | bg / surface / border | `#ffffff` / `#f6f7f9` / `#e5e8ec` |
| Parent | text / muted | `#1b1f24` / `#5a6470` |
| Parent | accent / hover / on-accent | `#0e9f8e` / `#0c8c7d` / `#ffffff` |
| Kid | coral / soft | `#ff6f59` / `#ffe1da` |
| Kid | turquoise / soft | `#0e9f8e` / `#d9f2ef` |
| Kid | yellow / soft | `#ffc93c` / `#fff3d6` |
| Kid | cream / text | `#fff8ec` / `#2b2116` |
| Teen | navy / surface | `#1f2a44` / `#26314d` |
| Teen | mint / text / muted | `#7fd8c4` / `#e9edf5` / `#9aa6c3` |

## Mark (O3)
- Soft **Ster** + trailing **wisp** (playful motion).
- Files: `apps/web/public/brand/mark.svg`, `icon.svg`; `Design System/brand/`; iOS `Resources/Brand/` + `WispelMark.swift`.
- Web component: `apps/web/components/brand/WispelWordmark`.
- Uses `currentColor` — place on accent text.

## Type
| Surface | Face |
| --- | --- |
| Parent dashboard | system-ui stack (`--font-sans`) |
| Marketing headlines | Outfit (`--font-display` / `font-display`) |
| Kid web previews | Fredoka (`--font-rounded`); iOS uses SF Rounded |

## Icons (chrome)
Parent dashboard nav: stroke SVG set in `NavIcon` — no emoji in chrome.  
Task/reward/avatar emoji remain product content (O12: emoji subset for avatar v1).

## Mascot (O7)
**Postponed** past Horizon B brand foundation. Do not invent Vinkie replacement in shipping UI.

## Do / Don’t
- Do: brand-first marketing; gratis + privacy early; parent calm / kid warm / teen muted.
- Don’t: Held/Hero nouns; purple-on-white cliché; cream+#blue family-SaaS twin; donations on child tabs.
