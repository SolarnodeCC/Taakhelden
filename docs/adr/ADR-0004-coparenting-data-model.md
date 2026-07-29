# ADR-0004: Co-ouderschap — datamodel (concept)

**Status:** Concept — **niet goedgekeurd**  
**Datum:** 2026-07-29  
**Blokkeert:** iOS Phase 3 Epic E7, API-migraties, web co-ouderflows

## Context

TaakHelden ondersteunt vandaag één `family` per kindprofiel. In de Nederlandse markt is co-ouderschap over twee huishoudens een veelgevraagde feature (productvoorstel §7, iOS bouwvoorstel §11 Fase 3). Het huidige datamodel (`members.family_id`, ledger per `child_id`) kan dit niet zonder breuk uitbreiden.

Het bouwvoorstel waarschuwt expliciet: *“niet half modelleren”* — geen voorbereidende kolommen of UI tot dit ADR is besloten.

## Beslissing

**Nog geen beslissing.** Dit document legt opties en exit-criteria vast voor een PO/architectuur-workshop.

## Opties

### Optie A — Eén kind-identiteit, meerdere gezinslidmaatschappen (aanbevolen richting)

```
child_identities (id, display_name, birth_year, ...)
family_memberships (child_identity_id, family_id, role, pin_hash?, ...)
points_ledger (child_identity_id, family_id?, amount, ...)  // of single ledger per identity
```

- **Pro:** Eén puntenhistorie; kind wisselt context “bij mama / bij papa”.
- **Con:** Autorisatie complex (`JWT` bevat actieve `family_id` + `child_identity_id`); migratie bestaande kinderen.

### Optie B — Gekoppelde dubbele profielen

Twee `members` records (`linked_member_id`) met optionele sync van saldo.

- **Pro:** Minimale wijziging aan bestaande `family_id`-scope.
- **Con:** Dubbele avatar, sync-conflicten, dubbele ledger-sommen — moeilijk uit te leggen aan ouders.

### Optie C — Primair gezin + gast-leestoegang

Secundair gezin ziet read-only voortgang; taken alleen in primair gezin.

- **Pro:** Kleinste API-wijziging.
- **Con:** Productmatig waarschijnlijk onvoldoende voor NL co-ouderschap.

## Gevolgen (indien Optie A)

| Laag | Werk |
|---|---|
| D1 | Nieuwe migratie; backfill bestaande `members` → identities |
| API | Auth: child-session kiest actieve `family_id`; repo’s scopen op beide ids |
| iOS | Profielkiezer + context-switch; geen dubbele onboarding |
| Web | Uitnodiging tweede ouder; gezinsdoelen over huishoudens heen? (open) |
| AVG | DPIA-update; verwerkersovereenkomst co-ouder als gezamenlijk verantwoordelijke? |

## Niet-doelen

- Gedeelde puntenpot over **niet-verwante** gezinnen
- Automatische merge van twee bestaande gezinnen zonder ouder-consent
- Phase 3 UI of API stubs vóór goedkeuring

## Exit-criteria voor goedkeuring

- [ ] PO + architect + security akkoord op gekozen optie
- [ ] DPIA-paragraaf co-ouderschap ingevuld
- [ ] Migratieplan met rollback
- [ ] Authz-testmatrix (kind ziet nooit ander gezin; ouder A ziet geen gezin B)
- [ ] `docs/ios-phase3-plan.md` §9 bijgewerkt met definitief model

## Referenties

- `docs/ios-phase3-plan.md` §9
- `docs/taakhelden-dpia-starter.md` (co-ouderschap expliciet buiten scope starter)
- `docs/taakhelden-productvoorstel.md` §7
