# ADR-0005: Workers Rate Limiting API for abuse-path rate limits

- Status: proposed
- Date: 2026-07-29
- Affects: `apps/api` (middleware, wrangler bindings), ops/deploy, observability
- Hard rules impact: none directly (no D1/SQL, ledger, or Zod contract change)
- Spec: `docs/atomic-rate-limiting-plan.md`

## Context

Auth and other abuse-sensitive routes use a fixed-window KV counter in
`apps/api/src/middleware/ratelimit.ts`. The implementation is an intentional
MVP gap: `get` → compare → `put` is not atomic, so concurrent bursts can
overshoot the configured limit. The code and architecture doc already point at
the Workers Rate Limiting API / WAF as the successor.

Closing the gap is not a small middleware patch. It requires Cloudflare
bindings (`ratelimits` in wrangler), account-scoped `namespace_id` inventory,
Env/type wiring, local/test strategy, and ops/observability — because rate-limit
bindings are not visible in the Cloudflare dashboard.

Cloudflare’s Rate Limiting API is GA. It is backed by the same infrastructure as
rate-limiting rules: colo-local, low-latency, eventually consistent / permissive
(not an accounting ledger).

## Decision

1. **Abuse rate limits** (auth public endpoints; later authenticated global
   ceiling) move to the **Workers Rate Limiting API** via wrangler `ratelimits`
   bindings — one binding per distinct `(limit, period)` pair.
2. **Exact counters stay on KV (or D1)** where we need accounting semantics:
   PIN fail lockout (`pinfail:*`), photo daily quota, notification daily caps,
   idempotency caches. Those must not use the Rate Limiting API.
3. **WAF custom rate-limit rules** are a complementary outer layer for
   zone-level volumetric attack (optional, post-MVP), not a replacement for
   in-Worker path-aware limits keyed by user/family.
4. **Durable Object rate limiting** is out of scope for this problem: DOs are
   already reserved for FamilyRoom ledger serialisation + WS; per-IP global
   atomic counters would add latency and cost without matching the colo-local
   abuse model Cloudflare already provides.

## Consequences

- `wrangler.toml` gains multiple `[[ratelimits]]` entries with stable
  account-unique `namespace_id` integers (string-encoded). Production and
  non-production must not share namespace IDs.
- Call sites stop passing ad-hoc `limit` / `windowSeconds` into a shared KV
  helper; they select a named binding (or a thin wrapper over named bindings).
- Periods are constrained by the platform to **10 or 60 seconds** only.
- Limits are **per Cloudflare location**, not global. Acceptable for a NL-first
  family app (traffic concentrates in a small set of EU colos); document this
  so security reviews do not expect global hard caps.
- Local `wrangler dev` / Vitest must either simulate `limit()` or skip
  enforcement behind a test-only stub — production behaviour cannot be fully
  asserted in Miniflare without a binding shim.
- Observability of 429s moves to Workers Logs / Analytics Engine; operators
  cannot “see” the binding counters in the dashboard today.

Exit criteria: see `docs/atomic-rate-limiting-plan.md` § Acceptance.
