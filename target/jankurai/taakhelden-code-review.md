# TaakHelden — Code Review (advisory)

> **Provenance.** This is a manual review by Claude of the **TaakHelden** repo
> (`solarnodecc/taakhelden`), written against TaakHelden's actual stack —
> Cloudflare Workers + Hono, D1, R2, the `FamilyRoom` Durable Object, and the
> Next.js parent dashboard. It is **not** Jankurai tool output: the Jankurai
> binary (v1.5.1, checksum-verified) is installed, but the sandbox's auto-mode
> classifier blocks executing it, so the canonical `target/jankurai/*` artifacts
> could not be generated. The audit brief also described a different codebase
> ("Qesto": React/Vite on Pages, Stripe, Resend, Vectorize, Workers AI) — none of
> those exist here, so those rules are marked N/A rather than forced onto this repo.

## Verdict

The codebase is **well-architected and disciplined**. The six hard architecture
rules in `CLAUDE.md` are respected throughout, SQL is parameterized everywhere,
tenant isolation via `familyId` is consistent, and the privacy-sensitive paths
(EXIF strip, no child PII, positive Dutch copy) are handled with real care. The
findings below are refinements, not structural problems. Nothing here is a
release blocker on its own; **F1** is the only correctness bug worth fixing
before the next release.

Severity legend: 🔴 high · 🟠 medium · 🟡 low · 🟢 verified-good (no action)

---

## Verified-good (things that are right, and load-bearing)

- 🟢 **Arch rule 1 — no SQL in routes.** `grep` for `.prepare(/.exec(/.batch(`
  under `apps/api/src/routes/` returns nothing. All SQL lives in `repo/`.
- 🟢 **Arch rule 2 — idempotency is race-safe.** The KV middleware
  (`middleware/idempotency.ts`) is a fast path, but the authoritative dedup runs
  *inside* the serialized DO turn (`do/FamilyRoom.ts:87 runIdempotent`, check +
  `INSERT OR IGNORE` on `idempotency_keys`). Two concurrent requests with the
  same key that both miss KV cannot double-book. `requireIdempotencyKey` is
  enforced on `/rewards/:id/redeem` and the complete path.
- 🟢 **Arch rule 3 — balance is always `SUM(points_ledger)`** (`repo/ledger.ts:27`).
  No stored-balance field anywhere.
- 🟢 **Arch rule 4 — no negative mechanics.** `applyAdjust` rejects `amount <= 0`
  (`pointsEngine.ts:307`); negative amounts occur only in `redemption` and
  `redemption_cancel`. `applyRedo`/`applyUndo` never debit.
- 🟢 **Arch rule 5 — privacy.** Photos are only served at status `ready`
  (`routes/photos.ts:63`), which is set only *after* the queue consumer strips
  metadata; if the strip fails the object is **deleted** and marked `failed`
  (`jobs/photoConsumer.ts:38`). Only one `console.*` in the whole API and it logs
  `err.message` only. EXIF stripper (`services/exif.ts`) is dependency-free and
  fails closed.
- 🟢 **Arch rule 6 — Zod validation** at every mutation route via
  `validate("json", …)` with schemas from `packages/shared`.
- 🟢 **SQL injection.** Every dynamic SQL fragment (`updateTask`, `updateReward`,
  `listEntries`, `dayStats` IN-clauses) is built from **whitelisted column names /
  generated `?` placeholders**, values always bound. Confirmed no user value
  reaches a query string.
- 🟢 **AuthN.** JWT is HS256 via `jose` with a symmetric key, so alg-confusion /
  `none` is structurally rejected; ws-typed tokens are refused on the API path
  (`middleware/auth.ts:13`). Apple sign-in verifies issuer + audience against
  Apple's JWKS (`services/apple.ts`). Passwords use PBKDF2-SHA256 with a
  constant-time compare (`services/passwords.ts`). Refresh tokens are rotated
  (`consumeRefreshToken`).
- 🟢 **Web BFF.** Tokens live only in `httpOnly` cookies (`lib/api/cookies.ts`),
  `secure` in production, `sameSite=lax`; the proxy marks responses `no-store`.
  `API_BASE_URL` is server-only (not `NEXT_PUBLIC_`), so no secret reaches the
  client bundle.
- 🟢 **IDOR.** Child-facing reads are ownership-checked (`points.ts:41`,
  `photos.ts:155`, `pointsEngine requireOwnInstance`). Repo functions are always
  `familyId`-scoped.
- 🟢 **Housekeeping jobs exist.** `purgeOldIdempotencyKeys` and
  `purgeExpiredAccounts` run in cron, so the `idempotency_keys` table and the
  GDPR-delete flow are both handled.

---

## Findings

### 🟠 F1 — Malformed `?cursor=` on `GET /points/ledger` returns 500, not 400
`apps/api/src/routes/points.ts:53`
```ts
const cursor = rawCursor
  ? (JSON.parse(atob(rawCursor)) as { createdAt: string; id: string })
  : undefined;
```
`atob` / `JSON.parse` run on unvalidated user input with no `try/catch`. Any
malformed cursor (truncated link, tampering, a client bug) throws `SyntaxError`,
which falls through to the generic handler as **`500 INTERNAL`**. A bad *request*
should be a `400`. It's not a security hole (the value is only used as an
opaque pagination token and the query is still `familyId`-scoped), but it's a
user-controlled 500 and it pollutes error metrics.
**Fix:** wrap the decode in `try/catch` and throw
`ApiException(400, VALIDATION_FAILED, "Ongeldige cursor.")`; ideally validate the
decoded shape with a small Zod schema before use.

### 🟡 F2 — `POST /points/adjust` mutates without requiring an Idempotency-Key
`apps/api/src/routes/points.ts:78` uses `idempotency` (optional) but not
`requireIdempotencyKey`. `redeem` and `complete` require the header; `adjust`
does not. A retried adjust with no key double-credits (positive-only, so not a
debit exploit, but still a wrong balance). The DO-side dedup only engages when a
key is present. **Fix:** add `requireIdempotencyKey` to `adjust` for parity with
the other ledger-writing mutations, or consciously document why it's exempt.

### 🟡 F3 — URL-signing HMAC reuses `JWT_SECRET`
`services/photoService.ts` / `routes/photos.ts` sign presigned photo-transfer
URLs with `c.env.JWT_SECRET`. Reusing the session-signing secret for a second
purpose means a rotation of one forces the other and widens blast radius if
either leaks. **Fix:** introduce a dedicated `PHOTO_URL_SECRET` binding. Low
severity (same trust domain, short TTLs), but clean key-separation is cheap.

### 🟡 F4 — PBKDF2 iteration count (100k) is below current guidance
`services/passwords.ts:11` — documented as the Workers-native interim vs. the
Argon2 target in the architecture doc. OWASP's 2023 floor for PBKDF2-SHA256 is
600k. Note also that 4-digit child PINs are inherently brute-forceable offline
regardless of KDF; the real protection there is the 5-attempt lockout
(`routes/auth.ts`), which is correctly in place. **Fix (opportunistic):** raise
iterations toward the Workers CPU ceiling, or land the planned Argon2-wasm
upgrade — the self-describing hash format already supports mixed-cost migration.

### 🟡 F5 — Type-erasing `as unknown as` casts around D1 rows
11 occurrences (e.g. `getFamily(...) as unknown as FamilyRow`,
`user as unknown as ParentRow`). Each discards D1's row typing and trusts a
hand-written interface; a schema/interface drift would compile silently and blow
up at runtime. **Fix:** parse D1 rows through the shared Zod schemas (or a thin
typed row-mapper in `repo/`) so the boundary is validated once, not asserted.

### 🟡 F6 — Idempotency key is not scoped to path/body
`middleware/idempotency.ts` keys the cache on `(userId, Idempotency-Key)` only.
A client that reuses one key across two *different* endpoints gets the first
call's cached response back for the second. This matches many idempotency specs
(the key is the client's contract), so it may be intentional — but it's worth an
explicit note in the API spec, since a naive client could be surprised.

### 🟢/🟡 F7 — CORS: verified absent, and that is correct here (documentation gap only)
There is **no** CORS middleware on the Worker. Given the architecture — the web
app calls through the same-origin Next.js BFF proxy, and iOS uses a native client
— cross-origin browser access isn't needed, and critically there is **no
credentialed-wildcard misconfiguration** (the risk the audit brief flags). This
is a *non-finding* for security. The only suggestion: state the "no direct
browser origins" assumption somewhere in the API/arch docs so a future contributor
doesn't "helpfully" add `Access-Control-Allow-Origin: *` with credentials.

---

## Governance artifacts (audit brief asked to surface these)

All of the following are **absent**:
`agent/owner-map.json`, `agent/test-map.json`, `agent/generated-zones.toml`,
`agent/audit-policy.toml`, `AGENTS.md`, `.pre-commit-config.yaml`.

Caveat: these are **Jankurai's** governance layout, and Jankurai was never
actually adopted in this repo (the audit brief's "already installed" premise was
incorrect). TaakHelden instead governs via `.claude/` — custom agents
(`architecture-reviewer`, `ui-design-reviewer`, …), skills, and **enforcement
hooks** (`.claude/hooks/block-migration-edit.mjs`,
`.claude/hooks/guard-route-sql.mjs`) that mechanically defend arch rules 1 and
"never edit a migration." So the *intent* of owner-map / audit-policy / pre-commit
is partially met by a different, working mechanism. Treat "adopt Jankurai's
governance files" as optional, not a defect — unless you specifically want the
Jankurai loop as your merge gate, in which case run `jankurai adopt` once the
run-permission is granted.

## Not applicable (Qesto-only rules from the brief)

Stripe webhook signature verification, Workers-AI prompt sanitization
(`c.env.AI.run()`), Vectorize input validation, KV-session-token TTLs for an
AI product — **none of these subsystems exist in TaakHelden.** (The KV entries
that *do* exist — `idem:*`, `pinfail:*`, `photoq:*` — all set explicit TTLs.)

## Suggested priority order
1. **F1** (small, real bug) — fix now.
2. **F2**, **F5** — cheap correctness/robustness hardening.
3. **F3**, **F4** — security hygiene, schedule.
4. **F6**, **F7** — documentation.
