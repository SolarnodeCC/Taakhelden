---
name: investigating-bugs
description: A structured 5-step debug protocol for FamilyRoom Durable Object and WebSocket issues in TaakHelden. Use when diagnosing FamilyRoom failures, WS disconnects, ledger-write anomalies, or timer/alarm problems.
---
# Skill: Investigating Bugs (TaakHelden)
# SCOPE: FamilyRoom DO / WebSocket / ledger root-cause diagnosis
# LOAD: when debugging FamilyRoom failures, WS disconnects, ledger anomalies
# OWNER: Backend/DevOps

## Role
Structured root-cause investigator for Durable Object and WebSocket failures. You diagnose
efficiently, minimize time-to-resolution, and escalate when tooling limits are reached.

Follow `.claude/skills/COMMON_RULES.md` for global constraints.

## 5-step protocol

```
1. REPRODUCE   → Minimal scenario · which family · one client vs concurrent
2. OBSERVE     → wrangler tail · logs in do/FamilyRoom.ts · WS close codes
                 (1001=away, 1006=abnormal, 4xxx=app)
3. HYPOTHESISE → Causal chain: "If X then Y because Z" + a ruling-out list
4. TEST        → Minimal change to prove/disprove — no refactoring during investigation
5. CONCLUDE    → Root cause in one sentence · fix or workaround · issue if > 30 min
```

## FamilyRoom / WS / ledger checklist

**Connection & scoping:**
- [ ] `FAMILY_ROOM` binding present; DO named `idFromName(familyId)`?
- [ ] Client sends a valid token on the WS upgrade, and the DO scopes every message to that family?

**Ledger integrity (the #1 area):**
- [ ] Concurrent task completions for one family serialize through the DO (no lost/duplicate writes)?
- [ ] Balance read is `SUM(points_ledger)` — not a cached counter that can drift?
- [ ] Idempotency-Key dedupes a replayed award so points land exactly once?

**Post-restart state:**
- [ ] Any in-memory cache is rebuilt from storage after a DO restart (not assumed to survive)?
- [ ] A rejected cached storage promise clears itself so a later call retries?

**Alarm/timer & broadcast:**
- [ ] Alarm cleared before re-set on a timer reset?
- [ ] The right family receives the broadcast (no cross-family leakage)?

## Common patterns

| Symptom | Most likely cause |
|---|---|
| Points double-counted on retry | Idempotency-Key not honored on the ledger write |
| Balance drifts from the ledger | A cached counter used instead of `SUM(points_ledger)` |
| Points lost under concurrency | Writes not serialized through the FamilyRoom DO |
| WS disconnect loop | Token expired; client reconnects without a fresh token |
| All writes fail after one storage blip | Cached rejected storage promise not cleared |
| One malformed WS message breaks the family session | Missing outer handler try/catch |

## Escalate to architect when
1. Root cause not found within 2 iterations of step 4
2. Fix requires a DO migration (`[[migrations]]` in `wrangler.toml`)
3. Bug only reproducible in production
4. It implicates the ledger/idempotency contract itself

## Output contract
```markdown
## Investigation Report — <date>
**Problem**: <1 sentence>
**Environment**: <family / client scenario>
**Root cause**: <1 sentence>
**Evidence**: log line + code location (file:line)
**Fix**: <change or workaround>
**Prevention**: <issue? Yes/No — link>
```

## Do not
- Refactor during investigation — prove the hypothesis with a minimal change.
- Skip the ledger/FamilyRoom checklist — that's the #1 cause here.
- Speculate — follow the protocol to evidence (file:line + log line).
- Commit without `npm test` passing.
