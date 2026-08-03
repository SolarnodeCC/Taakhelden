# Security Audit Report: Wispel (TaakHelden)

**Review date**: 2026-08-03
**Reviewer**: security architecture review (code + configuration + design)
**Commit / branch**: `claude/website-security-audit-5p46ws`
**Scope**: `apps/api` (Cloudflare Worker), `apps/web` (Next.js parent dashboard + BFF),
`packages/shared` (Zod contracts), `.github/workflows` (deployment), `apps/api/wrangler.toml`,
`apps/web/wrangler.jsonc`. The SwiftUI client in `apps/ios` was reviewed only where it
consumes the API contract; no Swift source was audited.

**Technology stack**: TypeScript · Hono on Cloudflare Workers · D1 (SQLite) · R2 · KV ·
Durable Objects · Cloudflare Queues · Next.js 15 (App Router, OpenNext → Workers) ·
Zod · jose (HS256 JWT) · PBKDF2-SHA256 (WebCrypto).

**Data handled**: children's display names, birth years, avatars, task photos, points
ledger; parents' e-mail addresses and password hashes. Dutch families, GDPR/AVG applies,
with heightened obligations because data subjects are minors (AVG art. 8, DPIA in
`docs/taakhelden-dpia-starter.md`).

---

## Remediation status

The four HIGH findings and three MEDIUM findings (8, 10, 13) were remediated on branch
`claude/website-security-audit-5p46ws` (see PR #86). Each carries a **Status** line below.
Regression tests live in `apps/api/test/auth-hardening.test.ts` and
`apps/web/lib/api/crossOrigin.test.ts` — every one fails against the pre-fix code.
The remaining MEDIUM, LOW and INFO findings are open.

---

## Executive summary

The application's core data-security architecture is sound: every SQL statement lives in
the repo layer with `family_id` as a mandatory scope, all dynamic SQL is built from
whitelisted column names with bound parameters, refresh-token rotation is atomic and
single-use, EXIF stripping fails closed, and no XSS sink (`dangerouslySetInnerHTML`,
`eval`) exists anywhere in the codebase. There is no SQL injection, no cross-family data
leak, and no hardcoded production secret.

The defects are concentrated in the **anti-abuse and session-lifecycle layers**, and two
of them are load-bearing. First, the rate limiter keys on `CF-Connecting-IP`, which the
Next.js BFF never forwards — so *every* request that originates from the web app collapses
into one shared counter, allowing an unauthenticated attacker to deny login and
registration to all users worldwide with roughly five requests per minute. Second, the
Turnstile check fails open when its secret is unset, and the production deploy workflow
actively asserts that registration succeeds with the placeholder token `dev-bypass` —
meaning CI requires bot protection to be off in production. Compounding this, access
tokens are never checked against the database, so deleting a child or revoking their
device sessions leaves a working 24-hour token in the attacker's hands while the API
reports success.

None of these is a data breach on its own, so no finding is rated CRITICAL. Findings 1
through 4 should be treated as release blockers.

---

## High-severity findings

### [HIGH] Rate limiting & DoS: every web request shares one global rate-limit bucket

**Location**: `apps/api/src/middleware/ratelimit.ts:17` ·
`apps/web/app/api/v1/[...path]/route.ts:18-26` · `apps/web/app/api/auth/login/route.ts:18-23` ·
`apps/web/lib/api/config.ts:52-77`

**Description**: The rate limiter derives its bucket from the `CF-Connecting-IP` request
header and falls back to the literal string `"local"` when the header is absent. The BFF
reaches the API Worker over a service binding by constructing a brand-new `Request` whose
headers are built from scratch — only `Authorization`, `Content-Type` and
`Idempotency-Key` are copied. `CF-Connecting-IP` is therefore never present on any
API request that originated in the browser, and every such request lands in the same
counter.

**Current implementation**:

```ts
// apps/api/src/middleware/ratelimit.ts:17-24
const ip = c.req.header("CF-Connecting-IP") ?? "local";
const window = Math.floor(Date.now() / (windowSeconds * 1000));
const key = `rl:${bucket}:${ip}:${window}`;
const current = Number((await c.env.KV.get(key)) ?? "0");
if (current >= limit) {
  throw new ApiException(429, ErrorCodes.RATE_LIMITED, "Even rustig aan — probeer het zo weer.");
}
```

```ts
// apps/web/app/api/auth/login/route.ts:18-23 — no client IP forwarded
res = await apiFetch("/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(parsed.data),
  cache: "no-store",
});
```

The effective key for every browser login is `rl:login:local:<window>`, with `limit = 5`
per 60-second window.

**Risk**: Two distinct impacts.

*Availability (primary).* An unauthenticated attacker sends six `POST /api/auth/login`
requests per minute to the public dashboard. The sixth exhausts the global bucket, and
every legitimate parent worldwide receives `429 RATE_LIMITED` for the remainder of the
window. Sustained at ~0.1 requests per second — indistinguishable from normal traffic and
requiring no botnet — this denies login and registration to the entire user base
indefinitely. The same applies to `register` (5/min), `refresh` (30/min) and `export`
(3/hour): a single actor can lock every family out of GDPR data export for an hour.

*Anti-abuse (secondary).* Because the bucket no longer distinguishes callers, it provides
no per-attacker throttling. Credential stuffing against `/auth/login` from many source IPs
is limited only by the same global counter that legitimate users are also consuming, so
the limiter cannot be tightened without making the product unusable.

Note also that the limiter is read-then-write against eventually-consistent KV and is
explicitly documented as non-atomic, so even a correctly-keyed bucket undercounts under
concurrency.

**Remediation**: Forward the originating client IP across the BFF hop and fail closed when
it is missing. In the BFF, propagate the header on every proxied call:

```ts
// apps/web/app/api/v1/[...path]/route.ts
const buildHeaders = (token: string): HeadersInit => {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const clientIp =
    req.headers.get("CF-Connecting-IP") ?? req.headers.get("X-Forwarded-For")?.split(",")[0]?.trim();
  if (clientIp) headers["X-Forwarded-For"] = clientIp;
  // ...existing Content-Type / Idempotency-Key handling
  return headers;
};
```

Apply the same to `app/api/auth/{login,register,accept-parent}/route.ts`. In the Worker,
trust that header **only** from the service binding (it is not attacker-controllable there,
since the BFF overwrites it), and refuse to serve anonymous traffic with a shared bucket:

```ts
// apps/api/src/middleware/ratelimit.ts
const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For") ?? null;
// No identifiable caller → do not fall back to a shared bucket.
const subject = ip ?? `anon:${crypto.randomUUID()}`;
```

Longer term, replace the KV counter with the Workers Rate Limiting API (atomic) or enforce
these limits at the WAF, as `ratelimit.ts:8-10` already anticipates. For authentication
specifically, add a second dimension keyed on the account (`rl:login:acct:<emailHash>`) so
that credential stuffing is bounded per target regardless of source IP.

**Status**: ✅ **Fixed.** `middleware/ratelimit.ts` now resolves the caller from
`CF-Connecting-IP` or `X-Forwarded-For` and never falls back to a shared bucket; an
unidentified caller gets its own key. The BFF forwards the client IP on every hop
(`lib/api/config.ts` `forwardHeaders`, applied in the `/api/v1` proxy and all
`/api/auth/*` routes). Added `rateLimitSubject` and account-keyed limits on login
(10/15 min), registration (3/hour) and family-code lookup (20/hour), so throttling is
bounded per target even when the source IP rotates. Subjects are SHA-256 hashed so
e-mail addresses never appear as KV keys.

**References**: OWASP ASVS 4.0 V11.1.4 · CWE-770 (Allocation Without Limits) · CWE-307
(Improper Restriction of Excessive Authentication Attempts) · Cloudflare Workers Rate
Limiting API.

---

### [HIGH] Authentication: Turnstile fails open, and production CI requires it to be off

**Location**: `apps/api/src/services/turnstile.ts:5-6` · `apps/api/src/routes/auth.ts:42-49` ·
`.github/workflows/deploy-prod.yml` (Smoke test step) · `apps/api/wrangler.toml` (`[secrets] required`)

**Description**: `verifyTurnstile` returns `true` — i.e. "this is a human" — whenever the
secret is not configured. The secret is optional: `wrangler.toml` lists only `JWT_SECRET`
as required, and the deploy workflow's `put_secret` helper silently skips
`TURNSTILE_SECRET` when the GitHub Environment does not define it. There is no startup
check, no log line, and no health-check signal distinguishing "Turnstile enforced" from
"Turnstile disabled".

**Current implementation**:

```ts
// apps/api/src/services/turnstile.ts:5-6
export async function verifyTurnstile(secret: string | undefined, token: string, ip?: string): Promise<boolean> {
  if (!secret) return true; // dev/test: geen Turnstile geconfigureerd
```

```yaml
# .github/workflows/deploy-prod.yml — runs against production on every merge to main
-d "{\"email\":\"$email\",\"password\":\"SmokeTestPassword1\",\"familyName\":\"Smoke\",\"displayName\":\"Smoke\",\"turnstileToken\":\"dev-bypass\"}")
echo "register status=$code"
test "$code" = "201"
```

**Risk**: The smoke test is not merely tolerant of the fail-open — it *depends* on it. A
literal string `dev-bypass` can never validate against Cloudflare's siteverify endpoint, so
the assertion `test "$code" = "201"` can only pass if `TURNSTILE_SECRET` is unset in
production. Enabling Turnstile therefore breaks the deployment pipeline, which creates
standing pressure to leave it disabled. The practical consequence is that
`POST /v1/auth/register` on the production Worker is an unauthenticated, unprotected
account-creation endpoint. Combined with finding 1 (the global rate-limit bucket provides
no per-attacker throttling), an attacker can mass-create families, filling the shared D1
database and the R2 photo bucket, and can enumerate registered e-mail addresses through the
`409 EMAIL_IN_USE` response — a distinguishable oracle that Turnstile is the only control
against automating.

Note additionally that `POST /auth/login` calls `verifyTurnstile` nowhere at all
(`grep` confirms `register` is the only call site), so password guessing has no bot
protection under any configuration.

**Remediation**: Three changes, all required.

1. Fail closed in production. Make the behaviour depend on an explicit environment flag
   rather than on the accidental absence of a secret:

   ```ts
   export async function verifyTurnstile(
     secret: string | undefined,
     token: string,
     ip?: string,
   ): Promise<boolean> {
     if (!secret) {
       // Only dev/test may skip the check; production must fail closed.
       throw new Error("TURNSTILE_SECRET is not configured");
     }
     // ...existing siteverify call
   }
   ```

   and add `TURNSTILE_SECRET` to `[secrets] required` in `wrangler.toml` so the deploy
   fails loudly rather than degrading silently.

2. Fix the smoke test so it no longer asserts a bypass. Assert that registration with a
   bogus token is *rejected* (`400 VALIDATION_FAILED`), which is a stronger signal that the
   endpoint is healthy *and* protected. See also finding 7 — this test should not be
   writing to the production database at all.

3. Extend Turnstile to `POST /auth/login`, or gate it behind a failure counter so the
   challenge appears after the first failed attempt for an e-mail address.

**Status**: ✅ **Fixed.** `verifyTurnstile` now throws when `TURNSTILE_SECRET` is unset;
skipping the check requires the explicit `TURNSTILE_DEV_BYPASS="true"` flag, which is set
only in `vitest.config.ts` and never by wrangler or the deploy workflow. `TURNSTILE_SECRET`
was added to `[secrets] required` in `wrangler.toml`, and the deploy job fails with an
explicit error when the GitHub Environment does not define it. The smoke test now asserts
the rejection path (`400`) instead of requiring the bypass to succeed.

*Not done:* extending Turnstile to `POST /auth/login` — that changes `LoginBody` and the
iOS contract. The new account-keyed login limiter covers the brute-force gap in the
meantime; see the note under "Deliberately out of scope".

**References**: OWASP ASVS 4.0 V2.2.1 · CWE-636 (Not Failing Securely) · CWE-799
(Improper Control of Interaction Frequency).

---

### [HIGH] Session management: access tokens cannot be revoked; "revoke sessions" is misleading

**Location**: `apps/api/src/middleware/auth.ts:7-25` · `apps/api/src/services/session.ts:12-13` ·
`apps/api/src/routes/members.ts:159-172,193-202` · `apps/api/src/routes/auth.ts:151-154`

**Description**: `authMiddleware` verifies the JWT signature and expiry and then trusts the
claims wholesale. It performs no database lookup, so it cannot observe that the subject has
since been deleted, had their sessions revoked, or had their permissions downgraded. Access
tokens are long-lived: one hour for parents, **24 hours for children**.

**Current implementation**:

```ts
// apps/api/src/middleware/auth.ts:12-23 — no DB check, no revocation list
const payload = await verifyJwt(header.slice(7), c.env.JWT_SECRET);
if (!payload || payload.typ === "ws") { throw new ApiException(401, ...); }
const auth: AuthContext = {
  userId: payload.sub, familyId: payload.fam,
  role: payload.role, permissions: payload.perm ?? "full",
};
```

```ts
// apps/api/src/services/session.ts:12-13
export const ACCESS_TTL_PARENT = 60 * 60;      //  1 u
export const ACCESS_TTL_CHILD = 24 * 60 * 60;  // 24 u
```

```ts
// apps/api/src/routes/members.ts:159-172 — revokes refresh tokens only
return c.json(RevokeChildSessionsResult.parse({
  ok: true,
  revokedCount: await revokeChildDeviceSessions(c.env.DB, familyId, memberId),
}));
```

**Risk**: Three concrete scenarios, all reachable through supported product flows.

*Revocation that does not revoke.* A parent discovers their child's tablet has been taken
by someone else and uses the dedicated `POST /members/:id/device-sessions/revoke` control.
The API returns `{ok: true, revokedCount: N}`. The holder of the device retains a fully
valid access token for up to 24 hours and continues to read the family's tasks, points
ledger, sibling names, and task photos. The parent has been explicitly told the sessions
were revoked. This is the most serious variant, because the product promises a security
control it does not deliver.

*Deletion that does not delete.* `DELETE /members/:id` soft-deletes the child row, but the
same 24-hour window applies. Under AVG art. 17 (erasure), continued authenticated access to
family data after a deletion request is a compliance exposure, not only a technical one.

*Privilege downgrade lag.* `permissions` is a JWT claim. Downgrading a co-parent from
`full` to `approve_only` leaves their existing token asserting `full` for up to an hour,
during which they can still delete children, rotate the invite code, and delete the
account.

Parent logout has the same shape: `POST /auth/logout` revokes the refresh token but the
access token stays valid for its remaining lifetime — significant on shared or family
computers.

**Remediation**: Introduce a revocation check that does not require a database round-trip
on every request. The cheapest correct approach for this architecture is a KV-backed
revocation epoch per subject, checked in `authMiddleware`:

```ts
// On revoke/delete/permission-change, bump the subject's epoch:
await env.KV.put(`rev:${userId}`, String(Date.now()), { expirationTtl: ACCESS_TTL_CHILD });

// In authMiddleware, after signature verification:
const revokedAt = await c.env.KV.get(`rev:${payload.sub}`);
if (revokedAt && payload.iat && payload.iat * 1000 < Number(revokedAt)) {
  throw new ApiException(401, ErrorCodes.UNAUTHORIZED, "Sessie verlopen, log opnieuw in.");
}
```

This requires adding `iat` to the signed payload (`signJwt` currently sets only
`exp`). KV's eventual consistency makes this best-effort within seconds, which is
acceptable for a control that today has a 24-hour gap; for the revoke endpoint
specifically, consider also writing the epoch into the FamilyRoom DO, which is
strongly consistent per family.

Independently, reduce `ACCESS_TTL_CHILD` from 24 hours to something on the order of one
hour. The child device already holds a 30-day refresh token
(`CHILD_REFRESH_TTL_DAYS = 30`) and `POST /auth/child-session/refresh` is cheap, so the
long access TTL buys no offline capability that rotation does not already provide, while it
sets the floor on every revocation delay.

**Status**: ✅ **Fixed.** `signJwt` now sets `iat`, and `services/revocation.ts` keeps a
per-user revocation epoch in KV that `authMiddleware` checks on every request (one KV read,
no D1 in the hot path). The epoch is bumped by `POST /members/:id/device-sessions/revoke`,
`DELETE /members/:id`, `POST /auth/logout` and `DELETE /account`. A token without `iat`
against a revoked subject is rejected — fail closed. `ACCESS_TTL_CHILD` dropped from 24 h to
1 h; the iOS client already refreshes on 401 (`TaakHeldenAPIClient.swift:310`), so this
costs no offline capability.

**References**: OWASP ASVS 4.0 V3.3.1, V3.3.2 · CWE-613 (Insufficient Session Expiration) ·
CWE-863 (Incorrect Authorization) · AVG art. 17.

---

### [HIGH] Brute force: child PIN lockout depends on non-atomic, eventually-consistent counters

**Location**: `apps/api/src/routes/auth.ts:172-225` · `apps/api/src/middleware/ratelimit.ts:11-25` ·
`packages/shared/src/schemas/auth.ts:20-24`

**Description**: A child account is protected by a 4-digit numeric PIN (10,000 values)
plus a 6-character family code. Two controls gate guessing, and both are read-then-write
counters in Cloudflare KV, which is eventually consistent across edge locations and offers
no atomic increment.

**Current implementation**:

```ts
// apps/api/src/routes/auth.ts:193-209
const attemptsKey = `pinfail:${child.id}`;
const attempts = Number((await c.env.KV.get(attemptsKey)) ?? "0") + 1;
await c.env.KV.put(attemptsKey, String(attempts), { expirationTtl: PIN_LOCK_MINUTES * 60 });
if (attempts >= PIN_MAX_ATTEMPTS) {   // PIN_MAX_ATTEMPTS = 5
  const until = new Date(Date.now() + PIN_LOCK_MINUTES * 60 * 1000).toISOString();
  await repo.setPinLock(c.env.DB, family.id as string, child.id as string, until);
  ...
}
```

```ts
// packages/shared/src/schemas/auth.ts:20-24
export const ChildSessionBody = z.object({
  familyCode: z.string().length(6),
  childId: z.string(),
  pincode: z.string().regex(/^\d{4}$/),
});
```

**Risk**: Requests issued concurrently from multiple Cloudflare edge locations each read a
stale `pinfail` value before any of them writes, so the counter advances by roughly one per
*round* rather than per *attempt*. The durable lock in D1 (`setPinLock`) is only written
once the in-memory counter is observed to reach 5, so if the counter never converges, the
lock never engages. The outer per-IP limiter (`child-session`, 10/min) has the identical
race, and — per finding 1 — degenerates to a single global bucket for any traffic arriving
through the BFF.

An attacker needs the 6-character family code, which is not a secret in practice: it is
printed on the dashboard for sharing (`InviteCodeCard.tsx`), read aloud to children, and
handed to anyone invited to the family. `POST /auth/family-code` then returns every child's
`id`, `displayName`, `avatarId` and `ageMode` without authentication, supplying the
`childId` needed for the next step. From there, 10,000 candidate PINs against a lockout
that may not converge is a realistic path to full child-account takeover — which grants
read access to the child's task photos, points history, and sibling names.

**Remediation**: Move the failure counter into the FamilyRoom Durable Object, which is
strongly consistent and already serialises per-family writes, or make D1 the counter of
record with an atomic conditional update:

```sql
-- Atomic: increment and lock in one statement, no read-then-write race.
UPDATE users
   SET pin_fail_count = pin_fail_count + 1,
       pin_locked_until = CASE WHEN pin_fail_count + 1 >= 5
                               THEN datetime('now', '+15 minutes')
                               ELSE pin_locked_until END
 WHERE family_id = ? AND id = ?;
```

Then read back the row and reject when `pin_locked_until` is in the future. Keep the KV
counter only as a fast pre-filter, exactly as the DO already treats KV for idempotency
(`do/FamilyRoom.ts:95-105` documents this pattern).

Additionally: apply exponential backoff rather than a flat 15-minute window so repeated
lockout cycles become progressively expensive, and consider raising the PIN to 6 digits for
`teen` age mode where usability permits. Rate-limit `POST /auth/family-code` per family
code (not only per IP) so child-roster enumeration cannot be automated cheaply.

**Status**: ✅ **Fixed.** Migration `0009_pin_fail_count.sql` adds `users.pin_fail_count`,
and `registerPinFailure` increments it in a single `UPDATE … RETURNING`, so concurrent
attempts can no longer all read the same stale value. Lock duration now doubles per full
round of five failures (15 min → 4 h cap). The KV counter is gone. Parents are notified
once per lock round rather than on every attempt. `POST /auth/family-code` is additionally
rate-limited per family code, so the child roster cannot be harvested from many IPs.

**References**: OWASP ASVS 4.0 V2.2.1, V11.1.4 · CWE-307 · CWE-367 (TOCTOU Race Condition).

---

## Medium-severity findings

### [MEDIUM] Infrastructure: production has no environment isolation; `[env.production]` is dead configuration

**Location**: `apps/api/wrangler.toml:53-56` · `.github/workflows/deploy-prod.yml`
(D1-migraties / Deploy API steps)

**Description**: `wrangler.toml` declares an `[env.production]` block whose comment claims
that production inherits the base bindings. Wrangler does not inherit D1, R2, KV, Durable
Object, or Queue bindings into a named environment — those keys are non-inheritable and
must be redeclared. The block declares none, and the deploy workflow never passes
`--env production` anyway:

```toml
# apps/api/wrangler.toml:1-3, 53-56
name = "taakhelden-api"
...
[env.production]
name = "taakhelden-api-prod"
# production heeft eigen D1/R2/KV — id's invullen na aanmaken
```

```yaml
# .github/workflows/deploy-prod.yml
command: d1 migrations apply taakhelden-db --remote   # no --env
command: deploy                                        # no --env
```

**Risk**: There is exactly one deployed environment. The Worker that serves production
traffic is the top-level `taakhelden-api`, bound to the D1 database, R2 bucket and KV
namespace whose IDs are committed in git. Any developer running
`wrangler d1 execute taakhelden-db --remote` or `wrangler dev --remote` from a checkout
operates directly against live family data, including children's records — with no
staging tier in between and no configuration change required to do so. The `[env.production]`
block gives a false impression that isolation exists; a future operator who adds
`--env production` would silently deploy a Worker with no database bindings at all.

**Remediation**: Either delete the misleading `[env.production]` block and document
explicitly that this is a single-environment deployment (acceptable pre-launch, but it must
be a stated decision), or complete it properly:

```toml
[env.production]
name = "taakhelden-api-prod"

[[env.production.d1_databases]]
binding = "DB"
database_name = "taakhelden-db-prod"
database_id = "<separate production database>"

[[env.production.r2_buckets]]
binding = "PHOTOS"
bucket_name = "taakhelden-photos-prod"
jurisdiction = "eu"

[[env.production.kv_namespaces]]
binding = "KV"
id = "<separate production namespace>"
# durable_objects, queues, triggers, vars likewise
```

and pass `--env production` in both the migration and deploy steps. Given the data is
children's PII, a separate production tier with restricted API-token scope should be
treated as a launch prerequisite.

**Status**: ✅ **Resolved as a documented single-environment deployment** (owner's call).
The dead `[env.production]` block is removed, and `wrangler.toml` now states plainly that
the top-level bindings *are* production, why wrangler would not have inherited them, and
that there is consequently no staging tier — so any `--remote` command from a checkout
touches live family data. This removes the footgun where adding `--env production` would
have deployed a Worker with no database. Building a genuinely separate production tier
remains available if the risk appetite changes; it needs new Cloudflare resources.

**References**: OWASP ASVS 4.0 V14.1.1 · CWE-1188 (Insecure Default Initialization) ·
Cloudflare Wrangler environments documentation (non-inheritable keys).

---

### [MEDIUM] Business logic: `Idempotency-Key` is scoped to the user only, not to the operation

**Location**: `apps/api/src/middleware/idempotency.ts:14` · `apps/api/src/do/FamilyRoom.ts:97-107`

**Description**: Both the KV fast path and the authoritative Durable Object dedup store key
the cached response on `(userId, key)` with no component identifying the operation:

```ts
// apps/api/src/middleware/idempotency.ts:14
const kvKey = `idem:${auth.userId}:${key}`;
```

```ts
// apps/api/src/do/FamilyRoom.ts:99-104
const storeKey = `${body.actor.userId}:${rawKey}`;
const cached = await getIdempotencyResponse(this.env.DB, storeKey);
if (cached) return JSON.parse(cached);
```

The behaviour is deliberate and documented in `.claude/rules/api/middleware.md`, so this is
raised as a design risk rather than an unintended bug.

**Risk**: A client that reuses one key across two different operations gets the first
operation's response back for the second, with HTTP 200 and no error. Concretely: a child
completes task A with key `K`, then a UI bug, a retry wrapper, or a screen-scoped key
generator reuses `K` for redeeming a reward. The redemption never executes, the points are
never deducted, and the client is told it succeeded — the ledger and the UI diverge with no
signal to either the child or the parent. The 24-hour KV TTL and the D1 store widen the
window considerably. Because the same key also short-circuits *before* authorization
outcomes are recomputed, a key minted under one set of circumstances can return a stale
success after those circumstances change.

**Remediation**: Include the operation and a request-body fingerprint in the key, which
preserves genuine retry semantics while making cross-operation reuse impossible:

```ts
// apps/api/src/middleware/idempotency.ts
const fingerprint = await sha256Hex(`${c.req.method}:${new URL(c.req.url).pathname}:${await c.req.raw.clone().text()}`);
const kvKey = `idem:${auth.userId}:${key}:${fingerprint}`;
```

Apply the same in `FamilyRoom.runIdempotent` using `path` (already a parameter) plus the
serialized mutation body. When a key arrives with a *different* fingerprint than the stored
one, return `409` rather than the cached response — that is the standard contract (IETF
`Idempotency-Key` draft, §2.7) and turns a silent no-op into a loud client error. Update
`docs/taakhelden-api-specificatie.md` accordingly.

**References**: IETF draft-ietf-httpapi-idempotency-key-header §2.7 · OWASP ASVS 4.0
V11.1.2 · CWE-840 (Business Logic Errors).

---

### [MEDIUM] Deployment: the production smoke test writes real accounts to the live database

**Location**: `.github/workflows/deploy-prod.yml` (Smoke test step)

**Description**: Every merge to `main` registers a family against the production API:

```yaml
email="smoke-$(date +%s)@example.com"
code=$(curl -sS -o /tmp/reg.json -w "%{http_code}" \
  -X POST https://taakhelden-api.oostelaar.workers.dev/v1/auth/register ...)
test "$code" = "201"
```

**Risk**: Each deploy leaves an orphaned family, parent user, password hash, refresh token
and invite code in the production D1 database, none of which is ever cleaned up. Beyond
data hygiene, this pollutes the production dataset used for GDPR reporting and any future
analytics, and it consumes invite-code space from a keyspace that is already modest
(finding 12). It also couples release health to a bypass of the anti-bot control, as
detailed in finding 2. The workflow correctly avoids logging the response body — the 201
contains live access and refresh tokens — which is good practice and should be preserved.

**Remediation**: Point the write-path smoke test at a staging environment (see finding 5).
If that is not yet available, assert the *rejection* path instead, which validates
reachability, routing, JSON handling and the anti-bot control without creating state:

```bash
code=$(curl -sS -o /dev/null -w "%{http_code}" \
  -X POST "$API/v1/auth/register" -H "Content-Type: application/json" \
  -d '{"email":"smoke@example.com","password":"short","familyName":"S","displayName":"S","turnstileToken":"x"}')
test "$code" = "400"   # schema rejects the password; nothing is written
```

If an end-to-end write test is genuinely required, add an authenticated teardown step that
deletes the created family via `DELETE /v1/account`, and fail the job when teardown fails.

**References**: OWASP ASVS 4.0 V14.1.1 · CWE-489 (Active Debug Code).

---

### [MEDIUM] Secrets management: photo/export URL signing falls back to the JWT signing key

**Location**: `apps/api/src/services/secrets.ts:10-12` · `apps/api/wrangler.toml:49-51`

**Description**: `transferHmacSecret` prefers a dedicated `HMAC_SECRET` but silently falls
back to `JWT_SECRET`. Only `JWT_SECRET` is listed as required, and the deploy workflow skips
`HMAC_SECRET` when the GitHub Environment does not define it — so the fallback is the
likely production state.

```ts
export function transferHmacSecret(env: Pick<Env, "JWT_SECRET" | "HMAC_SECRET">): string {
  return env.HMAC_SECRET || env.JWT_SECRET;
}
```

**Risk**: One key secures two trust domains with very different exposure profiles. Photo and
export signatures travel in URL query strings (`?fam=…&exp=…&sig=…`), where they reach
browser history, `Referer` headers, CDN and proxy logs, and any analytics that captures
URLs. A key-recovery or oracle weakness reachable through that high-exposure surface would
also yield the ability to forge authentication tokens for every family in the system —
turning a photo-link leak into total authentication bypass. Key separation is what keeps
those blast radii distinct. It also blocks independent rotation: rotating the transfer key
after a leak currently means invalidating every active session.

**Remediation**: Add `HMAC_SECRET` to `[secrets] required` in `wrangler.toml`, remove the
fallback, and fail closed:

```ts
export function transferHmacSecret(env: Pick<Env, "HMAC_SECRET">): string {
  if (!env.HMAC_SECRET) throw new Error("HMAC_SECRET is not configured");
  return env.HMAC_SECRET;
}
```

Generate it in the deploy workflow the same way `JWT_SECRET` is bootstrapped
(`openssl rand -hex 32`), and document both in a rotation runbook. This is already flagged
as F3 in `.claude/rules/api/services-and-do.md`; this finding confirms it remains open.

**Status**: ✅ **Fixed.** `transferHmacSecret` throws when `HMAC_SECRET` is unset — the
`JWT_SECRET` fallback is gone. Added to `[secrets] required`, and the deploy workflow
bootstraps a random value when the GitHub Environment has none (same pattern as
`JWT_SECRET`, generated rather than copied so the keys genuinely differ), so requiring it
cannot break a deploy. Rotating it now only invalidates signed URLs, which live 5 minutes.

**References**: OWASP ASVS 4.0 V6.4.1 · NIST SP 800-57 Part 1 §5.2 (key separation) ·
CWE-1279 (Cryptographic Key Reuse Across Contexts).

---

### [MEDIUM] Frontend: CSP permits inline scripts and wildcard connect/img sources

**Location**: `apps/web/next.config.mjs:15-30`

**Description**: The dashboard ships a considered CSP, but three directives are permissive
enough to blunt it:

```js
"script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
"img-src 'self' data: blob: https:",
"connect-src 'self' https: wss:",
```

**Risk**: `'unsafe-inline'` in `script-src` is the directive that makes CSP an XSS mitigation
rather than a formality; with it present, any future injected `<script>` or inline event
handler executes normally. `connect-src https: wss:` then permits exfiltration to any host
on the internet, and `img-src https:` provides a second channel via image beacons. No XSS
sink exists in the codebase today (see Positive observations), so this is defence-in-depth
rather than an active vulnerability — but it removes the safety net precisely where family
and child data is rendered.

**Remediation**: Next.js 15 supports nonce-based CSP via middleware, which removes the need
for `'unsafe-inline'`:

```ts
// apps/web/middleware.ts
const nonce = crypto.randomUUID();
const csp = [
  "default-src 'self'",
  `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",           // Tailwind still needs this
  "img-src 'self' data: blob: https://taakhelden-api.oostelaar.workers.dev",
  "connect-src 'self' https://taakhelden-api.oostelaar.workers.dev wss://taakhelden-api.oostelaar.workers.dev",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'",
].join("; ");
```

Pin `img-src` and `connect-src` to the API origin (available as `API_BASE_URL`) rather than
the `https:`/`wss:` wildcards. Roll out behind `Content-Security-Policy-Report-Only` first
to catch violations. `frame-ancestors 'none'`, `base-uri` and `form-action` are already
correct and should be kept.

**References**: OWASP ASVS 4.0 V14.4.3 · MDN CSP `strict-dynamic` · CWE-1021 (Improper
Restriction of Rendered UI Layers).

---

### [MEDIUM] Frontend: no CSRF defence beyond `SameSite=Lax` on the cookie-authenticated BFF

**Location**: `apps/web/lib/api/cookies.ts:10-15` · `apps/web/app/api/v1/[...path]/route.ts:73-77`

**Description**: The BFF proxy exposes `POST`, `PUT`, `PATCH` and `DELETE` for every API
path and authenticates purely from the `th_at` cookie. The only cross-site protection is
the cookie's `SameSite=lax` attribute; there is no CSRF token and no `Origin`/`Sec-Fetch-Site`
validation.

**Risk**: `SameSite=Lax` does block cross-site form and `fetch` POSTs in current browsers, so
this is not directly exploitable today — hence MEDIUM rather than HIGH. It is, however, a
single point of failure: the protection evaporates for users on older browsers, and it
depends on Lax's carve-outs never widening. Since every state-changing family operation
(create child, set PIN, adjust points, delete account) routes through this one handler, the
blast radius of that single control failing is the entire mutation surface.

**Remediation**: Add an `Origin` check to the proxy — cheap, stateless, and independent of
cookie semantics:

```ts
// apps/web/app/api/v1/[...path]/route.ts, at the top of proxy()
if (!["GET", "HEAD"].includes(req.method)) {
  const origin = req.headers.get("Origin");
  const expected = new URL(req.url).origin;
  if (origin && origin !== expected) {
    return NextResponse.json(
      { error: { code: ErrorCodes.FORBIDDEN, message: "Ongeldige herkomst." } },
      { status: 403 },
    );
  }
}
```

Apply the same guard to `app/api/auth/*`. Consider tightening the session cookies to
`sameSite: "strict"`; the dashboard has no cross-site entry flow that would break, and the
`uitnodiging` accept page uses its own token rather than the session cookie.

**Status**: ✅ **Fixed.** `crossOriginBlock` (`lib/api/config.ts`) rejects any
state-changing request whose `Origin` is not the request's own origin, applied to the
`/api/v1` proxy and every `/api/auth/*` route plus `/api/ws/connect`. Safe methods are
never blocked, and a missing `Origin` is allowed — non-browser clients omit it, and
`SameSite` still covers the browser case there. Cookie `sameSite` was left at `lax`: the
invitation-accept flow is a cross-site entry point, and `strict` would need its own
verification.

**References**: OWASP ASVS 4.0 V4.2.2 · OWASP CSRF Prevention Cheat Sheet
(defence-in-depth) · CWE-352.

---

### [MEDIUM] Access control: the family invite code doubles as the child login credential

**Location**: `apps/api/src/services/ids.ts:16-21` · `apps/api/src/routes/auth.ts:157-169` ·
`apps/web/app/[locale]/(dashboard)/gezin/InviteCodeCard.tsx`

**Description**: `newFamilyCode()` produces a 6-character code from a 31-symbol alphabet.
The same value serves two purposes with incompatible security requirements: it is the
shareable identifier a parent hands out to invite others, *and* it is the first factor of
child login. `POST /auth/family-code` accepts it unauthenticated and returns the family name
plus every child's id, display name, avatar and age mode.

```ts
export function newFamilyCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let s = "";
  for (const b of bytes) s += alphabet[b % alphabet.length];  // 31 symbols
  return s.toUpperCase();
}
```

**Risk**: The keyspace is 31⁶ ≈ 8.9 × 10⁸ — adequate against a single-IP guesser, but the
code is by design widely shared and never rotated when a family member leaves. Anyone who
has ever held it (a former co-parent, a classmate's household, anyone who saw a screenshot)
retains indefinite ability to enumerate the family's children — first names, ages and
avatars of minors — without authenticating, and to begin PIN guessing (finding 4). The
`b % 31` construction also introduces a small modulo bias, since 256 is not a multiple of
31: the first eight symbols of the alphabet are ~3% likelier, marginally reducing effective
entropy.

**Remediation**: Separate the two roles.

1. Keep the shareable invite code for onboarding, but make child login require a
   family-scoped identifier that is not broadcast — or bind the child-login step to a device
   that a parent has explicitly paired.
2. Rotate the invite code automatically whenever a member is removed
   (`softDeleteMember`, co-parent removal); `setInviteCode` already exists in
   `repo/families.ts`.
3. Do not return the child roster unauthenticated. Return only an opaque family handle from
   `POST /auth/family-code` and require the PIN attempt to carry it, so the roster is never
   disclosed to an unauthenticated caller.
4. Remove the modulo bias with rejection sampling:

   ```ts
   function pick(alphabet: string): string {
     const max = 256 - (256 % alphabet.length);   // reject the biased tail
     for (;;) {
       const b = crypto.getRandomValues(new Uint8Array(1))[0]!;
       if (b < max) return alphabet[b % alphabet.length]!;
     }
   }
   ```

**References**: OWASP ASVS 4.0 V2.1.1, V6.3.1 · CWE-330 (Use of Insufficiently Random
Values) · CWE-200 (Exposure of Sensitive Information) · AVG art. 5(1)(c) (data minimisation).

---

### [MEDIUM] API security: no rate limiting on any authenticated endpoint

**Location**: `apps/api/src/index.ts:63-78` · all files under `apps/api/src/routes/` except
`auth.ts`, `account.ts` (export only) and `families.ts` (invite-link only)

**Description**: Rate limiting is applied to nine public endpoints. Every authenticated
route — tasks, instances, points, rewards, redemptions, members, devices, sync,
notifications, family goals, WebSocket token issuance — has none. The only quota anywhere in
the authenticated surface is the 20-photos-per-child-per-day counter in
`routes/photos.ts:94-100`.

**Risk**: Any account holder — including a child account, obtained through the PIN path in
finding 4 — can issue unbounded requests. `POST /sync` processes batched mutations, and
`GET /points/ledger` and `GET /instances/history` return up to 500 rows per call; both are
inexpensive to call and expensive to serve, against a D1 database shared with production
(finding 5). One compromised or malicious account can degrade the database for every family.
`POST /ws/token` is likewise unbounded, allowing cheap generation of connection tokens and
Durable Object churn.

**Remediation**: Apply a default per-user limit as middleware in `index.ts`, immediately
after `authMiddleware`, so new routes inherit protection rather than opting in:

```ts
app.use("*", async (c, next) => {
  const { userId } = c.get("auth");
  await rateLimit(c, `user:${userId}`, 300, 60);   // 300 req/min baseline
  return next();
});
```

Set tighter, explicit limits on the expensive paths (`/sync`, `/points/ledger`,
`/instances/history`, `/ws/token`). This depends on the counter fix from finding 1 to be
meaningful; key it on `auth.userId` rather than IP, which sidesteps the missing-header
problem entirely for authenticated traffic.

**Status**: ✅ **Fixed.** A baseline limit of 300 req/min per authenticated user is applied
as middleware in `index.ts`, directly after `authMiddleware`, so new routes inherit it
rather than opting in. It keys on `auth.userId`, so it holds even where the client IP does
not reach the Worker. Routes with stricter needs (export, photo quota) keep their own
limits on top. The counter is still KV read-then-write and so undercounts under
concurrency — see the note on the Workers Rate Limiting API below.

**References**: OWASP API Security Top 10 2023 — API4:2023 (Unrestricted Resource
Consumption) · CWE-770.

---

### [MEDIUM] Data protection: WebSocket credential travels in the URL query string

**Location**: `apps/api/src/routes/ws.ts:41-57` · `apps/api/src/index.ts:50` ·
`apps/web/lib/realtime/wsUrl.ts`

**Description**: The WebSocket upgrade authenticates via `GET /v1/ws?token=<jwt>`, because
the browser WebSocket API cannot set an `Authorization` header. The full request URL,
including the token, is then forwarded to the Durable Object
(`familyRoom.fetch(c.req.raw)`).

**Risk**: Query strings are logged by far more infrastructure than headers — Cloudflare
request logs, any intermediate proxy, browser history, and error-reporting tools that
capture URLs. A leaked token authorises a WebSocket subscription to the family's live event
stream: points changes, task completions, and child identifiers. The 60-second TTL and the
`typ: "ws"` claim (correctly rejected on the REST path by `middleware/auth.ts:13`) bound the
damage well, which is why this is MEDIUM rather than higher — the design is deliberate and
mostly well executed.

**Remediation**: Prefer the `Sec-WebSocket-Protocol` handshake header, which browsers do
allow and which is not logged as part of the URL:

```ts
// client
new WebSocket(url, ["wispel.v1", `auth.${token}`]);

// server: read from the header instead of the query string
const proto = c.req.raw.headers.get("Sec-WebSocket-Protocol") ?? "";
const token = proto.split(",").map((s) => s.trim()).find((s) => s.startsWith("auth."))?.slice(5);
```

Echo the accepted subprotocol back on the 101 response. If the query-string form must be
retained for compatibility, strip `?token=` from the URL before forwarding to the DO, and
confirm that Cloudflare Logpush is not configured to retain full request URIs for this
route.

**Status**: ✅ **Fixed for the web client; iOS on a compatibility path.** The token now travels in the handshake header as `Sec-WebSocket-Protocol: wispel.v1, auth.<token>` (`wsAuthSubprotocols` in `packages/shared`), and the FamilyRoom DO echoes `wispel.v1` back — without that echo browsers abort the handshake. The Worker also strips `?token=` before forwarding to the DO, so the token cannot reach a second log line.

`?token=` is still accepted because `apps/ios/.../FamilyRoomClient.swift:144` builds the URL that way and the Swift side cannot be verified from this repo. That fallback is the remaining exposure; it can be deleted once the iOS client sends the subprotocol.

**References**: OWASP ASVS 4.0 V3.5.3, V7.1.1 · CWE-598 (Information Exposure Through Query
Strings).

---

## Low-severity and informational findings

### [LOW] Data protection: `Strict-Transport-Security` is not set

**Location**: `apps/web/next.config.mjs:10-14`

The header set covers `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` and
`Permissions-Policy`, but omits HSTS. Cloudflare terminates TLS and can serve HSTS at the
zone level, so this may already be covered in the dashboard — verify, and if not, add:

```js
{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }
```

**Status**: ✅ **Fixed** — `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
added to `next.config.mjs`. Preload-list submission remains a manual step once `wispel.cc`
is live. **References**: OWASP ASVS V9.1.1 · CWE-319.

### [LOW] Web server: the API Worker emits no security headers

**Location**: `apps/api/src/index.ts` (no header middleware) ·
`apps/api/src/routes/photos.ts:71-74`

The API Worker is directly reachable at `taakhelden-api.oostelaar.workers.dev` and returns
no `X-Content-Type-Options`, `Referrer-Policy` or HSTS. This matters most for
`GET /v1/photos/:id/file`, which streams user-uploaded bytes with a client-declared (though
enum-constrained) content type. Add a global middleware:

```ts
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
});
```

**Status**: ✅ **Fixed** — global middleware in `index.ts` sets `X-Content-Type-Options`,
`Referrer-Policy: no-referrer` (which also keeps signed transfer URLs out of `Referer`)
and HSTS on every API response; the photo stream additionally sets `Content-Disposition`.
**References**: OWASP ASVS V14.4.1 · CWE-693.

### [LOW] Authentication: inconsistent password policy between registration and invitation

**Location**: `packages/shared/src/schemas/auth.ts:5` (`min(10)`) vs
`packages/shared/src/schemas/family.ts:119` (`min(8)`)

A co-parent accepting an invitation may set an 8-character password, while direct
registration requires 10. Both paths yield identical `full`/`approve_only` parent
privileges. Align on `min(10)` in `ParentAcceptBody`, and consider checking candidate
passwords against a breached-password list — length alone is a weak signal.

**Status**: ✅ **Fixed** — `ParentAcceptBody` now requires 10 characters, matching
`RegisterBody`. Breached-password checking remains open.
**References**: OWASP ASVS V2.1.1 · NIST SP 800-63B §5.1.1.2.

### [LOW] Authentication: JWT verification does not pin algorithm, issuer or audience

**Location**: `apps/api/src/services/jwt.ts:21-28`

```ts
const { payload } = await jwtVerify(token, enc(secret));
return payload as unknown as JwtPayload;
```

No `algorithms`, `issuer` or `audience` constraint, and the payload is type-asserted rather
than validated. Because the key material is a symmetric `Uint8Array`, jose will only accept
HS256/384/512 — `alg: none` and RS256 confusion are not reachable, so this is hardening
rather than a live vulnerability. Still, pin them explicitly and validate the shape:

```ts
const { payload } = await jwtVerify(token, enc(secret), {
  algorithms: ["HS256"], issuer: "wispel", audience: "wispel-api",
});
const parsed = JwtPayloadSchema.safeParse(payload);
return parsed.success ? parsed.data : null;
```

**Status**: ✅ **Fixed** — `verifyJwt` pins `algorithms: ["HS256"]` and validates the
payload with a Zod schema instead of type-asserting it, so a signature no longer implies
anything about the shape of `role`/`fam` that authorization depends on. `issuer`/`audience`
were deliberately **not** enforced: tokens already in circulation carry neither, so
requiring them would log every user out on deploy. Adding them needs a transition window
where signing emits the claims before verification demands them.
**References**: OWASP ASVS V3.5.3 · CWE-347.

### [LOW] Session management: no refresh-token reuse detection

**Location**: `apps/api/src/repo/auth.ts:97-111`

Rotation is correctly atomic and single-use — a replayed token simply fails. But replay is
the canonical signal that a refresh token was stolen, and it currently triggers nothing. On
a consumed-token replay, revoke the whole token chain for that user and notify the parent.

**Status**: ✅ **Fixed** — `POST /auth/refresh` now distinguishes "unknown token" from
"already consumed". On a replay it revokes every outstanding refresh token for that user
and bumps the revocation epoch, so both the legitimate client and the thief are forced to
re-authenticate. Parent notification on reuse is not implemented — it needs a copy decision
and belongs with the security-event logging in the INFO section.
**References**: OWASP ASVS V3.3.3 · OAuth 2.0 Security BCP §4.14.2.

### [LOW] Cryptography: PBKDF2 iteration count is below current guidance

**Location**: `apps/api/src/services/passwords.ts:11`

`ITERATIONS = 100_000` against OWASP's current recommendation of 600,000 for
PBKDF2-HMAC-SHA256. The comment correctly identifies the Workers CPU budget as the
constraint. The storage format is self-describing (`pbkdf2$<iters>$<salt>$<hash>`), so
raising the count or migrating to Argon2id later is straightforward — verification of old
hashes keeps working. Benchmark the achievable count within the Workers CPU limit and raise
**Status**: ✅ **Fixed — and the premise in this finding was wrong.** The code comment
claimed 100k was a Workers platform cap; measuring the runtime directly showed 600k is
accepted (~280 ms per derivation, on login paths only). Iterations raised to 600,000, the
OWASP figure. Because the stored format carries its own iteration count, existing hashes
keep verifying, and `needsRehash` re-hashes them on the next successful login (off the
response path via `waitUntil`). Child PINs migrate when a parent next sets one; for a
4-digit PIN the lockout, not the KDF, is the meaningful control anyway.
**References**: OWASP Password Storage Cheat Sheet (2024) · CWE-916.

### [INFO] Logging & monitoring: no security event logging

There is no audit trail for authentication failures, PIN lockouts, permission changes,
account deletion or export requests. The privacy discipline is excellent — `console.error`
appears exactly twice and logs only `err.message` — but the result is that a compromise
would leave no forensic record. Add structured, PII-free security events (event type,
`userId`, `familyId`, timestamp, outcome) to a dedicated sink, and alert on lockout and
deletion spikes. AVG art. 33 requires breach notification within 72 hours, which is
difficult to satisfy without an audit trail. **References**: OWASP ASVS V7.1 · AVG art. 33.

### [INFO] Compliance: no vulnerability disclosure policy

No `SECURITY.md` or `/.well-known/security.txt`. For a consumer app processing children's
data, publish a disclosure address and expected response time. **References**: RFC 9116.

### [INFO] Configuration: `APPLE_CLIENT_ID` will not match iOS-issued tokens

`apps/api/wrangler.toml` sets `APPLE_CLIENT_ID = "com.taakhelden.web"` while
`APPLE_BUNDLE_ID = "nl.taakhelden.app"`. `verifyAppleIdentityToken` validates `audience`
against `APPLE_CLIENT_ID` only, so identity tokens minted by the iOS app (audience = bundle
id) will fail verification. This is a functional bug that fails closed — noted here because
the natural fix (accepting an array of audiences) must be done deliberately rather than by
relaxing the check.

---

## Summary statistics

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 4 |
| Medium | 9 |
| Low | 6 |
| Info | 3 |
| **Total** | **22** |

---

## Positive observations

These are load-bearing controls that were verified as correctly implemented, and should be
protected against regression:

- **No SQL injection anywhere.** Every dynamic SQL fragment is assembled from whitelisted
  column maps (`repo/tasks.ts:38-51`, `repo/families.ts:40-50`) or fixed condition strings,
  with all values bound via `?`. Verified across all 14 repo modules.
- **Tenant isolation is structurally enforced.** Every repo function takes `familyId` as its
  first argument and every query carries `family_id = ?`. This is the correct compensating
  control for D1's lack of row-level security.
- **Refresh rotation is race-free** — `consumeRefreshToken` (`repo/auth.ts:103-110`) flips
  `revoked_at` in a single conditional `UPDATE` and treats the token as consumed only when
  `meta.changes` is non-zero.
- **EXIF stripping fails closed.** `services/exif.ts` returns `null` on any parse anomaly and
  the photo is not published, honouring the "no GPS data on children's photos" rule.
  Magic-byte validation also makes content-type confusion on upload impractical.
- **No XSS sink exists** — zero occurrences of `dangerouslySetInnerHTML`, `innerHTML`,
  `eval` or `new Function` in `apps/` and `packages/`.
- **Tokens are never exposed to client JS** — `httpOnly`, `sameSite=lax`, `secure` in
  production, and `API_BASE_URL` is server-only with no `NEXT_PUBLIC_` leak.
- **Constant-time comparison** is used for both password verification
  (`passwords.ts:51-54`) and photo URL signatures (`photoService.ts:49-52`).
- **Apple Sign-in is verified correctly** against Apple's JWKS with both `issuer` and
  `audience` pinned (`services/apple.ts:22-25`).
- **Supply chain is in good order** — `npm audit` reports 0 vulnerabilities, and all GitHub
  Actions are pinned to full commit SHAs.
- **No secrets in version control** — the only credential-shaped strings are explicitly
  labelled test fixtures (`vitest.config.ts:22`, `TestPassword_NotASecret_123`).
- **The DO idempotency design is sound in principle** — KV as a fast path with an
  authoritative check-and-write inside the serialised DO turn is the right pattern; only the
  key composition needs fixing (finding 6).
- **Cursor decoding is correctly guarded** — `atob`/`JSON.parse` are wrapped in try/catch and
  validated with Zod, returning 400 rather than 500 (`routes/points.ts:24-38`).

---

## Recommended remediation roadmap

### 1. Release blockers — ✅ done

| # | Finding | Status |
|---|---------|--------|
| 1 | Rate-limit bucket collapses to `"local"` | ✅ Fixed — caller-keyed limits + BFF IP forwarding + account-keyed limits |
| 2 | Turnstile fails open; CI asserts the bypass | ✅ Fixed — fails closed, required secret, smoke test asserts rejection |
| 3 | Access tokens cannot be revoked | ✅ Fixed — `iat` + KV revocation epoch; `ACCESS_TTL_CHILD` 24h → 1h |
| 4 | PIN lockout races on eventually-consistent KV | ✅ Fixed — atomic D1 counter + exponential backoff |

Regression coverage: `apps/api/test/auth-hardening.test.ts` (10 tests).

**Deliberately out of scope in that change**, and still open:

- **Turnstile on `POST /auth/login`.** Adding it changes `LoginBody` in `packages/shared`
  and the iOS request contract, which cannot be verified from this repo alone. The new
  account-keyed login limiter (10 attempts / 15 min per e-mail address, independent of
  source IP) bounds credential stuffing per target in the meantime.
- **Workers Rate Limiting API / WAF.** The KV counter is still read-then-write and so
  undercounts under concurrency. Now that it is correctly keyed, moving it to an atomic
  backend is a contained follow-up.
- **`HMAC_SECRET` in `[secrets] required`.** Belongs with finding 8, which also removes the
  `JWT_SECRET` fallback — doing only half of it would fail deploys without adding safety.

### 2. Before scaling beyond a pilot

| # | Finding | Status |
|---|---------|--------|
| 7 | Smoke test writes to the production database | ✅ Fixed with #2 — asserts rejection, writes nothing |
| 8 | `HMAC_SECRET` falls back to `JWT_SECRET` | ✅ Fixed — fallback removed, required + auto-bootstrapped |
| 10 | No CSRF defence beyond `SameSite=Lax` | ✅ Fixed — `Origin` check on every BFF mutation |
| 13 | No rate limiting on authenticated routes | ✅ Fixed — 300 req/min per user, inherited by new routes |
| 5 | No environment isolation; `[env.production]` is dead config | ⏳ **Open — needs an infrastructure decision.** Completing it requires real Cloudflare D1/R2/KV resources and their IDs; deleting the dead block instead is only correct if a separate production tier is not planned. |
| 6 | `Idempotency-Key` not scoped to operation | ⏳ Open — API contract change, needs coordinated iOS update |

### 3. Planned sprints

Findings 9 (CSP nonces), 12 (decouple invite code from child login — schedule as a product
change, it affects the login UX), 14 (WebSocket subprotocol auth).

### 4. Hardening backlog

✅ Done: HSTS, API security headers, password-policy alignment, JWT algorithm pinning and
payload validation, refresh-token reuse detection, PBKDF2 iteration count.

⏳ Still open: security event logging, `SECURITY.md` / `security.txt`, the
`APPLE_CLIENT_ID` audience mismatch, breached-password checking, JWT `iss`/`aud` (needs a
token transition window), and moving the KV rate-limit counter to an atomic backend.

---

## Security baseline checklist

| Control | Status | Reference |
|---------|--------|-----------|
| No secrets or credentials in codebase or configuration | ✅ Pass | Only labelled test fixtures |
| All user inputs validated and sanitised | ✅ Pass | Zod at every boundary; cursors guarded |
| All outputs properly encoded | ✅ Pass | React escaping; no HTML sinks |
| SQL queries parameterised | ✅ Pass | Whitelisted columns + bound params throughout |
| Authentication and authorisation enforced | ✅ Pass | Enforced per request and revocable since finding 3 was fixed |
| Error messages non-verbose | ✅ Pass | `middleware/error.ts` returns generic 500s |
| HTTPS enforced site-wide | ✅ Pass | TLS via Cloudflare; HSTS set on web and API — finding 15 |
| Security headers configured | ⚠️ Partial | Web and API both covered (finding 16); CSP still allows `'unsafe-inline'` — finding 9 |
| CSRF protection implemented | ✅ Pass | `SameSite=Lax` plus an `Origin` check on every BFF mutation — finding 10 |
| Rate limiting configured | ✅ Pass | Caller-, account- and user-keyed (findings 1, 13); KV counter still non-atomic under concurrency |
| Sensitive data encrypted | ✅ Pass | PBKDF2 hashes, SHA-256 refresh tokens, R2 EU jurisdiction |
| Logging excludes sensitive information | ✅ Pass | Two `console.error` calls, `err.message` only |
| Dependencies regularly scanned and updated | ✅ Pass | `npm audit` clean; Actions SHA-pinned |
| Least privilege access enforced | ✅ Pass | Roles correct; stale claims now bounded by the 1 h TTL and the revocation epoch |
| Audit logging enabled | ❌ **Fail** | No security event trail — finding 20 |

---

## Methodology and limitations

This review covered code-level analysis of all TypeScript sources in `apps/api`,
`apps/web` and `packages/shared`; configuration review of both Wrangler configs and all
GitHub Actions workflows; and architectural analysis of the trust boundaries between
browser, BFF, API Worker, Durable Object, D1, R2 and KV.

Not covered, and recommended as follow-up:

- **The iOS client** (`apps/ios`). It authenticates directly against the Worker with real
  client IPs, so its exposure to findings 1 and 4 differs from the web app's, and its
  keychain and certificate-pinning posture is unreviewed.
- **Live infrastructure state.** Cloudflare dashboard settings (WAF rules, zone-level HSTS,
  Logpush retention, R2 lifecycle policy, API token scopes) were not inspected. Several
  findings — notably 15 and 14 — depend on that configuration.
- **Runtime testing.** No dynamic testing or penetration testing was performed; all findings
  derive from source and configuration analysis. Findings 1, 2 and 4 in particular warrant
  runtime confirmation against a staging environment before and after remediation.
- **D1 migration history** (`apps/api/migrations/`) was not reviewed for schema-level
  constraints such as uniqueness on `invite_code` or cascade behaviour on soft delete.
