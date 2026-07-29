# Atomic rate limiting — Workers Rate Limiting API

Planning document for closing the known MVP gap in
`apps/api/src/middleware/ratelimit.ts`. Companion ADR:
[`docs/adr/ADR-0005-workers-rate-limiting.md`](./adr/ADR-0005-workers-rate-limiting.md).

This is **config + bindings + ops + a deliberate middleware redesign** — not a
20-line KV patch. Do not start coding until the binding inventory and Env split
(§3–4) are agreed.

---

## 1. Problem statement

### Current behaviour

```ts
const current = Number((await c.env.KV.get(key)) ?? "0");
if (current >= limit) throw …429…;
await c.env.KV.put(key, String(current + 1), { expirationTtl: … });
```

Fixed window per `(bucket, CF-Connecting-IP, window)`. Under concurrent
requests the read–modify–write races: N isolates can all observe `current <
limit` and all write. For a family-app MVP that overshoot is acceptable; for
auth abuse (credential stuffing, family-code enumeration) it is the wrong
long-term tool.

The file already documents the successor:

> Niet atomair — voor MVP-schaal ruim voldoende; strengere handhaving kan
> later via de Workers Rate Limiting API / WAF (zie architectuurdoc §3).

Architecture doc §3 already lists **Workers Rate Limiting API / WAF-rules** as
the intended product for login, PIN attempts, and uploads.

### Spec targets (`docs/taakhelden-api-specificatie.md` §4)

| Surface | Limit | Actor key today | Implemented? |
|---|---|---|---|
| `/auth/login`, `/auth/register`, `/auth/apple` | 5 / min | IP | Yes (KV) |
| `/auth/family-code`, `/auth/child-session` | 10 / min | IP | Yes (KV) |
| PIN fail lockout | 5 fails → 15 min lock | `childId` | Yes (KV `pinfail:*` + D1) |
| `/photos/upload-intent` | 20 / day / child | `childId` | Yes (KV quota — **accounting**) |
| Authenticated catch-all | 120 / min / user | `userId` | **Not implemented** |

Only the first two rows are in scope for the Rate Limiting API migration.
PIN lock and photo quota stay on exact stores (see §2.2).

---

## 2. Product choice (Cloudflare architect view)

### 2.1 Workers Rate Limiting API — choose this for in-Worker abuse limits

| Property | Implication for TaakHelden |
|---|---|
| GA binding (`env.X.limit({ key })` → `{ success }`) | First-class Worker API; no REST call from the Worker |
| Same infra as rate-limiting rules | Colo-local counters, async reconcile |
| `simple.limit` + `simple.period` ∈ `{10, 60}` | Binding-level config; **one binding per distinct limit/period pair** |
| Low latency (local cache, not a network hop) | Safe on auth hot path before D1/Turnstile |
| Permissive / eventually consistent | Fine for abuse ceilings; **not** for “exactly 5 PIN fails” |
| Not dashboard-visible | Ops must log 429s ourselves (§7) |
| Best-practice keys: user/API key/route — **not IP** | Public auth still needs a pre-auth key; see §5 |

Reference: [Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

### 2.2 What must NOT move to Rate Limiting API

| Concern | Why | Keep on |
|---|---|---|
| `pinfail:{childId}` (5 → lock) | Needs exact attempt count + parent notify | KV + D1 `pin_locked_until` |
| Photo 20/day quota | Product quota / accounting | KV (or later D1) |
| Notification daily caps | Product policy | KV |
| Idempotency response cache | Correctness, not rate | KV |

Conflating “rate limit” with “quota/lockout counter” is the main design trap.
The Rate Limiting API docs explicitly say it is not an accurate accounting
system.

### 2.3 Alternatives considered (and rejected for this epic)

| Option | Why not now |
|---|---|
| **KV + `Durable Object` mutex per key** | Correct but heavy; wrong place vs FamilyRoom; latency on every auth attempt |
| **WAF rate-limit rules only** | Good outer volumetric shield; cannot key on `userId` after JWT parse or on route-specific body fields inside Hono |
| **`unsafe` legacy binding** | GA `ratelimits` replaces it; do not start on deprecated shape |
| **Keep KV, add Lua-style compare-and-swap** | KV has no conditional put for this; still eventual |

**Recommended layered model (target state):**

```
Edge / WAF (optional later)     → volumetric IP/ASN ceilings
        ↓
Worker Rate Limiting bindings   → path-aware abuse (auth, later 120/min user)
        ↓
KV / D1 exact counters          → PIN lock, photo day-quota, product caps
        ↓
Turnstile                       → bot friction on register/login (already)
```

---

## 3. Binding design

Limits are configured **on the binding**, not as a runtime argument. Distinct
`(limit, period)` pairs ⇒ distinct bindings. Shared limit across buckets is
OK if they share a binding and differ only by `key`.

### 3.1 Proposed bindings (default / preview Worker)

| Binding name | `namespace_id` | `simple` | Used by |
|---|---|---|---|
| `RL_AUTH_STRICT` | `"1001"` (account-unique; pick free IDs) | `limit: 5`, `period: 60` | login, register, apple |
| `RL_AUTH_CHILD` | `"1002"` | `limit: 10`, `period: 60` | family-code, child-session |
| `RL_AUTHED_USER` *(phase 2)* | `"1003"` | `limit: 120`, `period: 60` | authenticated catch-all |

Production Worker (`[env.production]`) gets **different** namespace IDs (e.g.
`"2001"` / `"2002"` / `"2003"`) so preview traffic cannot pollute prod counters
and vice versa.

`namespace_id` is a **string containing a positive integer**, unique within the
Cloudflare account. There is no “create namespace” API — choosing an unused
integer *is* the provisioning step. Document chosen IDs in
`docs/cloudflare-bindings-audit.md`.

### 3.2 Wrangler sketch (`apps/api/wrangler.toml`)

```toml
[[ratelimits]]
name = "RL_AUTH_STRICT"
namespace_id = "1001"
simple = { limit = 5, period = 60 }

[[ratelimits]]
name = "RL_AUTH_CHILD"
namespace_id = "1002"
simple = { limit = 10, period = 60 }

# Phase 2 — authenticated ceiling
# [[ratelimits]]
# name = "RL_AUTHED_USER"
# namespace_id = "1003"
# simple = { limit = 120, period = 60 }

[env.production]
# …existing…
# Repeat [[env.production.ratelimits]] with 2001/2002/… namespace_ids
```

Exact TOML nesting for `[env.production]` must be verified against the wrangler
version pinned in the monorepo (array-of-tables under env). Treat wrangler
schema validation (`wrangler deploy --dry-run` / config check) as a gate in the
implementation PR — **do not invent IDs in code without updating the audit doc**.

### 3.3 Env / TypeScript

```ts
// apps/api/src/types.ts (additive)
interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  // …
  RL_AUTH_STRICT: RateLimitBinding;
  RL_AUTH_CHILD: RateLimitBinding;
  // RL_AUTHED_USER?: RateLimitBinding; // phase 2
}
```

Prefer Cloudflare’s generated / `@cloudflare/workers-types` `RateLimit` type
if the pinned types package already exports it; otherwise keep a minimal local
interface until types catch up.

---

## 4. Middleware redesign

### 4.1 Target API shape

Replace the KV helper with a binding-aware wrapper that preserves the call-site
feel but removes free-form limits:

```ts
// Conceptual — implementation PR owns the final signature
await rateLimit(c, "auth-strict");   // → RL_AUTH_STRICT, key = actorKey(c, …)
await rateLimit(c, "auth-child");    // → RL_AUTH_CHILD
```

Call sites in `routes/auth.ts` today:

| Route | Today | Target bucket |
|---|---|---|
| `POST /auth/register` | `rateLimit(c, "register", 5)` | `auth-strict` |
| `POST /auth/login` | `rateLimit(c, "login", 5)` | `auth-strict` |
| `POST /auth/apple` | `rateLimit(c, "apple", 5)` | `auth-strict` |
| `POST /auth/family-code` | `rateLimit(c, "family-code", 10)` | `auth-child` |
| `POST /auth/child-session` | `rateLimit(c, "child-session", 10)` | `auth-child` |

On `{ success: false }` → existing `ApiException(429, RATE_LIMITED, "Even rustig aan — …")`. Keep Dutch positive copy; no change to shared error codes.

### 4.2 Why this is more than a patch

1. Binding config is the source of truth for numeric limits (middleware must not
   silently diverge from wrangler).
2. `windowSeconds` parameter disappears (platform: 10 \| 60 only).
3. Env typing, vitest pool config, and production env tables all change.
4. Actor-key policy (§5) must be explicit and reviewed by security.
5. Dual-run / cutover (§8) needs an ops playbook, not a drive-by merge.

### 4.3 Logging (no PII)

On deny: structured log with `bucket`, `colo` (if available via `request.cf`),
hashed/truncated key fingerprint — **never** raw email, family code, or child
name. Align with CSO skill: auth/rate-limit failures logged with trace context.

---

## 5. Actor-key policy

Cloudflare docs discourage IP as the rate-limit key (CGNAT, school Wi-Fi, VPN
exit nodes → collateral lockouts). For TaakHelden:

| Phase | Surface | Key | Rationale |
|---|---|---|---|
| 1 | Public auth (pre-identity) | `ip:{CF-Connecting-IP}` **plus** route class in key prefix (`auth-strict:…`) | Only stable pre-auth signal; Turnstile remains second line on register/login |
| 1 | Optional hardening | After body parse: also limit `family-code:{normalizedCode}` on family-code / child-session | Slows enumeration of a single code from many IPs; **extra** `limit()` call, same or dedicated binding |
| 2 | Authenticated routes | `user:{userId}` | Matches API spec 120/min; CF best practice |
| — | Never | Raw family invite code, email, PIN, display name | PII / secret material must not become durable counter labels in logs or AE |

NL-first traffic + school Wi-Fi: expect occasional shared-IP false positives on
public auth. Mitigations: Turnstile, slightly higher child bucket (already
10/min), and parent-facing copy that is calm (“Even rustig aan”). Do **not**
raise limits casually to paper over IP sharing without measuring 429 rates.

---

## 6. Locality & accuracy (set expectations)

- Counters are **per Cloudflare location**. A distributed attacker hitting many
  colos gets many budgets. For credential stuffing against a NL family app this
  is still a large improvement over KV races in the colo that serves the burst.
- Counters are **permissive**: under extreme parallelism a colo may admit a
  few requests over the configured limit before caches converge. That is still
  bounded and intentional; it is not “atomic global accounting”.
- Naming in tickets/PRs: prefer **“colo-local abuse ceiling”** over “atomic
  global rate limit” to avoid false security claims.

If a future threat model requires **strict global** caps (e.g. per-family-code
across all colos), that is a different design (DO or central store) and should
be a new ADR — not a silent expectation of this binding.

---

## 7. Observability & ops

Rate-limit bindings are **not** shown in the Cloudflare dashboard today.

| Need | Approach |
|---|---|
| See 429 volume | Workers Logs / Logpush filter on `status=429` + `code=RATE_LIMITED` |
| Per-bucket metrics | Optional Analytics Engine binding: write `{ bucket, colo }` on deny |
| Alerting | Logpush → existing EU sink / Sentry spike on 429 rate (auth paths only) |
| Deploy checklist | Update `docs/cloudflare-bindings-audit.md` topology + binding table |
| Secret/CI | No new secrets; confirm deploy token can publish Worker with `ratelimits` |
| Rollback | Revert Worker version; namespace IDs are inert without code calling them |

Operator steps before first prod deploy of the implementation PR:

1. Confirm Workers Paid (already required for DO/Queues per architecture §6).
2. Reserve namespace IDs in the bindings audit (preview + production).
3. `wrangler deploy` to preview → smoke auth under parallel `curl` (see §9).
4. Merge → production deploy → watch 429 rate for 24–48 h.

---

## 8. Cutover plan (implementation PR series)

### Phase 0 — this document + ADR (docs only)

No runtime change. Accept ADR-0005.

### Phase 1 — Bindings + middleware (auth only)

1. Add `[[ratelimits]]` to `wrangler.toml` (+ production env).
2. Extend `Env` / generated types.
3. Rewrite `middleware/ratelimit.ts` to call bindings; **delete** KV `rl:*` path.
4. Update call sites in `routes/auth.ts` (bucket names only).
5. Vitest: inject a stub `RateLimitBinding` (in-memory counter) via test env so
   authz/auth tests remain deterministic; add a focused unit test that the
   middleware throws 429 when `success: false`.
6. Update `.claude/rules/api/middleware.md`, devops skill KV line, bindings
   audit, API structure comment if needed.
7. Manual burst smoke on preview (§9).

**No dual-write required** if preview soak is short: the KV limiter is already
best-effort. Optional dual-run (check binding **and** KV, log divergence) only
if security wants a comparison window — costs two systems and is usually not
worth it for auth ceilings.

### Phase 2 — Authenticated 120/min (close spec gap)

1. Add `RL_AUTHED_USER` binding.
2. Global middleware after `authMiddleware` for authenticated mounts
   (`/instances`, `/tasks`, …) — skip health, WS upgrade if needed.
3. Key = `user:{auth.userId}`.
4. Contract/tests for 429 on synthetic stub.

### Phase 3 — Optional WAF outer layer

Account/zone rate-limit rules for obvious volumetric patterns on
`/v1/auth/*`. Coordinate with whoever owns the zone DNS. Does not replace
Phase 1.

### Explicitly out of scope

- Changing PIN lock semantics or photo quotas.
- Per-family DO rate limiter.
- Dashboard UI for limits.
- Raising/lowering product numbers in the API spec without PO sign-off.

---

## 9. Test & verification strategy

| Level | What |
|---|---|
| Unit | Middleware: stub binding returns `success: false` → `ApiException` 429 + `RATE_LIMITED` |
| Unit | Middleware: `success: true` → next/handler runs; no KV `rl:` writes |
| Integration (Vitest pool) | Existing auth tests green with stubbed always-allow binding |
| Preview smoke | Parallel `curl`/`hey` against login & family-code; expect 429 after threshold *in that colo* |
| Regression | PIN lock still uses KV; photo quota unchanged |
| Typecheck | `Env` includes new bindings; `wrangler types` regenerated if that is repo practice |

Do not claim “exactly N requests then deny” in CI against real colo behaviour —
assert middleware contract against the stub. Colo accuracy belongs to preview
smoke + Cloudflare’s platform guarantees.

---

## 10. Docs & skill updates (checklist for implementation PR)

- [ ] `docs/adr/ADR-0005-workers-rate-limiting.md` — status → accepted
- [ ] `docs/cloudflare-bindings-audit.md` — `ratelimits` table + topology line
- [ ] `docs/taakhelden-cloudflare-github-architectuur.md` §3 — note “in use” + locality caveat
- [ ] `docs/taakhelden-api-specificatie.md` §4 — footnote: colo-local Workers RL; PIN/quota separate
- [ ] `.claude/rules/api/middleware.md` — Rate Limiting API, not KV `rl:*`
- [ ] `.claude/skills/devops.md` — KV row no longer lists abuse rate limits
- [ ] `.claude/skills/cso.md` — reference binding-backed limiter

---

## 11. Work breakdown (invasiveness)

| Workstream | Components | Invasiveness |
|---|---|---|
| A. Config / ops | `wrangler.toml`, bindings audit, namespace ID reservation, deploy smoke | Medium — touch production Worker config; low code risk |
| B. Middleware + types | `ratelimit.ts`, `types.ts`, auth call sites | Low–medium — small surface, auth-critical path |
| C. Test harness | Vitest env stub for `RL_*` | Medium — easy to get wrong and flake CI |
| D. Observability | Structured 429 logs; optional Analytics Engine | Low |
| E. Phase 2 global user limit | `index.ts` mount order, skip-list for public routes | Medium — easy to accidentally rate-limit health/WS |
| F. WAF (optional) | Zone rules outside repo | Ops-only |

**Risk hotspots:** (1) wrong/shared `namespace_id` across envs, (2) IP collateral
on school networks, (3) test env missing binding → runtime TypeError in CI,
(4) conflating PIN/quota with RL API.

**Dependencies:** Workers Paid (already), wrangler version that supports GA
`ratelimits`, security review on key policy (§5).

---

## 12. Acceptance criteria

- [ ] ADR-0005 accepted (or explicitly superseded).
- [ ] Auth routes no longer read/write `rl:*` KV keys.
- [ ] Preview + production each have documented, distinct `namespace_id`s.
- [ ] 429 responses unchanged in shape (`RATE_LIMITED` + existing NL message).
- [ ] PIN lock + photo quota behaviour unchanged (regression tests green).
- [ ] Burst smoke on preview demonstrates denials under parallel load.
- [ ] Bindings audit + middleware rule docs updated.
- [ ] No child PII in rate-limit logs.

---

## 13. Suggested ticket split

1. **Docs/ADR** — this plan (done when merged).
2. **api: RL bindings + auth middleware cutover** — Phase 1 implementation.
3. **api: authenticated 120/min** — Phase 2 (closes open spec gap).
4. **ops: WAF auth volumetric rules** — Phase 3, optional.
5. **obs: 429 Analytics Engine dashboard** — optional follow-up.
