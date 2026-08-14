# Extended Security Audit: Wispel (TaakHelden) — August 2026

**Scope**: full review of the API Worker (`apps/api`), the shared contract
(`packages/shared`), and the Next.js BFF + dashboard (`apps/web`), with emphasis on
family-tenant isolation, child privacy, and the unauthenticated attack surface.

**Method**: manual code review of every pre-auth route, the auth/session/revocation
machinery, the repo layer's `family_id` scoping, all dynamic SQL, the photo and export
signed-URL flows, the FamilyRoom DO, the BFF proxy and cookie handling, CSP/security
headers, CI supply chain, and dependencies. Findings were reproduced as executable tests
before being fixed.

**Baseline**: this report follows
[`wispel-security-audit-2026-08.md`](./wispel-security-audit-2026-08.md), whose findings
were verified as genuinely remediated (see *Verification of prior findings*). Everything
below is **new**.

---

## Executive summary

The codebase is in good security shape. The hard architecture rules are enforced in
practice, not just documented: no route touches D1 directly, every repo function is
`family_id`-scoped, all dynamic SQL is built from whitelisted column maps with bound
parameters, and the ledger's double-spend protection is correctly implemented inside the
serialized Durable Object rather than relying on the racy KV cache in front of it.

Two real vulnerabilities were found, both reproduced with tests, both in the
**password-reset flow** — the one flow a user reaches precisely because they believe they
have been compromised. They compound: an attacker who has stolen a session can keep it,
and the victim's remediation attempt can itself be drowned out.

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | **HIGH** | Rate limits on `forgot-password` / `reset-password` are inert — no throttling at all | ✅ Fixed |
| 2 | **HIGH** | Password reset does not revoke live access tokens | ✅ Fixed |
| 3 | MEDIUM | Apple sign-in links to an existing account on an unverified email | ✅ Fixed |
| 8 | MEDIUM | Changing a child's PIN does not end sessions logged in with the old PIN | ✅ Fixed |
| 4 | LOW | `/families/parents/accept` had no rate limit | ✅ Fixed |
| 5 | LOW | Invite endpoints mint unlimited parallel valid tokens | ✅ Fixed |
| 6 | LOW | `X-Forwarded-For` fallback is client-controllable; comment claimed otherwise | ✅ Comment corrected |
| 7 | INFO | 6 dependency advisories, all dev-only | ◑ 2 cleared, 4 blocked upstream |

Every exploitable finding is closed. Findings 5 and 8 were resolved in a second pass,
findings 1–4 and 6 in the first. The four remaining dependency advisories are dev-only with
no runtime path and are blocked on an upstream zod v4 incompatibility — see finding 7 for
why forcing them is the wrong trade.

No finding is a direct breach of child data, so none is rated CRITICAL. Findings 1 and 2
together are a realistic account-takeover-persistence chain and were treated as release
blockers.

---

## [HIGH] 1. Rate limits on the password-reset endpoints do not fire

### What is wrong

Two independent defects line up into one hole.

**(a) The BFF drops the client IP on exactly these two routes.** Every other BFF handler
wraps its outbound headers in `forwardHeaders(req, …)`, which copies the caller's IP into
`X-Forwarded-For`. The `forgot-password` and `reset-password` handlers were the only two
that did not:

```ts
// apps/web/app/api/auth/forgot-password/route.ts:18 (before)
headers: { "Content-Type": "application/json" },
```

The BFF reaches the Worker over a service binding, which carries no `CF-Connecting-IP`.
So the Worker saw no caller identity whatsoever.

**(b) The Worker's "fail-safe" fallback is fail-open for the IP limit.** When no IP can be
resolved, `rateLimit` gives the request its own bucket:

```ts
// apps/api/src/middleware/ratelimit.ts:59
const subject = ip ?? `unidentified:${crypto.randomUUID()}`;
```

A fresh UUID per request means the counter is always 1, and the limit can never be
reached. That fallback is correct in intent — it was added so an unidentifiable caller
could not consume a *shared* budget — but its comment asserts the subject limits still
apply, and `forgot-password` / `reset-password` were the only public auth routes with **no
`rateLimitSubject` backstop**. `register` has one per email; `login` has one per account;
`family-code` has one per code. These two had nothing.

### Reproduction

Twelve consecutive requests against a documented budget of 5/min, sent exactly as the BFF
sent them (no IP headers):

```
AUDIT-1 statuses: 200,200,200,200,200,200,200,200,200,200,200,200
```

Zero throttling.

### Impact

- **Unauthenticated email bombing of any address.** `POST /auth/forgot-password` sends
  mail to any address a stranger supplies, at unlimited rate. That weaponises Wispel as a
  spam amplifier against a third party and burns the sending domain's reputation — which
  in turn silently breaks password reset and co-parent invites for real families.
- **Unbounded PBKDF2.** `reset-password` runs a 600,000-iteration derivation (~280 ms CPU)
  per call with no ceiling — CPU and cost amplification.
- **It disarms the victim's remediation.** Combined with finding 2, an attacker holding a
  stolen session can flood the reset endpoint while the victim tries to lock them out.

### Fix

Both layers, because either alone leaves the other latent:

- `forwardHeaders(req, …)` added to both BFF handlers, so the IP limit works as designed.
- `rateLimitSubject` backstops added in the Worker, keyed on something the attacker cannot
  vary: the submitted email for `forgot-password` (3/hour), the resolved account for
  `reset-password` (5/hour). These hold even when the IP is absent or rotated.

The email limit is applied **before** the user lookup, so a 429 cannot be used to
distinguish a registered address from an unregistered one. A test asserts this.

The misleading comment on `rateLimit` was corrected to state the trade-off explicitly:
a route that leans only on the IP limit is unbounded once the IP is gone, so every public
route needs a subject limit too.

---

## [HIGH] 2. Password reset leaves the attacker's access token alive

### What is wrong

`POST /auth/reset-password` revoked refresh tokens but never marked the user's already-issued
access tokens as revoked:

```ts
// apps/api/src/routes/auth.ts (before)
await repo.revokeAllRefreshTokensForUser(c.env.DB, userId);
return c.json({ ok: true });
```

Access JWTs are stateless. The codebase already has the mechanism for this —
`revokeIssuedTokens` writes a revocation epoch to KV that `authMiddleware` checks against
the token's `iat` — and **every other** teardown path calls it: logout, refresh-reuse
detection, child session revocation, member deletion, account deletion. Password reset was
the single exception, missed because it was fixed in an earlier commit (`b685a87`,
"revoke refresh tokens on password reset") that predates the revocation epoch introduced
in `66da736`.

### Reproduction

```
AUDIT-2 status after reset: 200
```

A token minted before the reset still authenticates `GET /families/me` afterwards.

### Impact

An attacker with a stolen access token keeps full parent-level access to the family — the
children's names, birth years, photos, and points — for the remaining token lifetime
(up to 1 hour) **after** the victim has changed their password. The user is shown a
successful reset and reasonably believes the intruder is out. That gap is also enough time
to re-establish persistence by inviting a co-parent.

### Fix

```ts
await repo.revokeAllRefreshTokensForUser(c.env.DB, userId);
await revokeIssuedTokens(c.env, userId);
```

Regression test asserts the stolen token now returns 401 after reset.

---

## [MEDIUM] 3. Apple sign-in linked accounts on an unverified email

`verifyAppleIdentityToken` discarded the `email_verified` claim, and the route linked an
Apple identity to any existing password account sharing the email:

```ts
const byEmail = await repo.getParentByEmail(c.env.DB, claims.email);
if (byEmail) { await repo.linkAppleSub(...); user = byEmail; }
```

If Apple ever issues a token with an unverified email, creating an Apple ID against a
victim's address is enough to take over their Wispel family without knowing the password.
Apple does verify in normal flows, so this is defence-in-depth rather than a live exploit —
but the claim exists precisely so relying parties check it.

**Fix**: `emailVerified` is now parsed (Apple sends it as boolean *or* string) and required
before linking. The unverified-but-matching case does **not** silently create a second
family — that would fork a parent away from their children with no explanation — it returns
a clear 401 directing the user to their password. An unverified address with no existing
account creates the family with a null email rather than claiming an address Apple will not
vouch for.

**Coverage**: the decision is now a pure exported function, `decideAppleAccount`, tested
exhaustively in `apple-linking.test.ts` across all five claim/account combinations. It was
extracted precisely because it could not otherwise be tested: `vi.mock` does not reach the
route, since both `SELF` and the pre-instantiated `src/index` run outside the test's module
graph, and the real verifier needs Apple's JWKS. Isolating the security decision from the
network call makes the risky half directly provable.

---

## [MEDIUM] 8. Changing a child's PIN did not end their sessions

`POST /members/:id/pincode` rewrote the PIN hash and cleared the lockout counters, but left
every existing session intact — both the child's live access token and their 30-day device
refresh token.

A PIN is changed *because* the old one stopped being secret: a sibling watched over the
child's shoulder, a classmate learned it. The parent performs the change, sees it succeed,
and reasonably concludes the other person is locked out. They are not — the already-paired
device keeps working indefinitely, because the device token survives and can mint fresh
access tokens for another 30 days.

This is the same shape as finding 2, in a different route: a credential-change path that
rewrites the secret without revoking what the old secret already granted.

**Fix**: the route now calls `revokeChildDeviceSessions` + `revokeIssuedTokens`, matching
what `device-sessions/revoke` and member deletion already did, and returns `revokedCount`
so the UI can tell the parent how many devices were signed out. A test asserts both the
access token and the device token stop working.

---

## [LOW] 4. No rate limit on the co-parent accept endpoint

`POST /families/parents/accept` is pre-auth and runs a 600k-iteration PBKDF2 per call. The
invite token is 256-bit so guessing is infeasible, but the compute was unbounded.
**Fixed**: `rateLimit(c, "parent-accept", 10)`.

## [LOW] 5. Invite endpoints minted unlimited parallel valid tokens

Both `POST /families/me/parents` and `GET /families/me/invites/:userId/link` minted a **new**
7-day KV token on every call without invalidating the previous one. Ten clicks left ten
independently valid invitations, each granting parent access to the family — full read
access to every child's profile, photos, and points. Rate-limited to 10/min and parent-only,
so this is a blast-radius and revocability concern rather than a way in: a link shared into
the wrong chat could not be withdrawn by generating a new one, which is exactly what a user
would expect to work.

**Fix**: both paths now go through one `issueInviteToken` helper that keeps a
`parentinvite:current:<familyId>:<userId>` pointer, deletes the previously outstanding token
before minting a replacement, and is cleared on accept. **One outstanding invitation per
invitee.**

> **Semantic change worth knowing**: generating a copy-link now invalidates the link that
> was emailed (and vice versa). That is the standard behaviour for invite systems and is
> what makes an invitation revocable at all, but it is a behaviour change, not a pure
> internal fix — if the product wants the emailed link to survive, this needs a different
> design (e.g. an explicit "revoke invitation" action instead).

## [LOW] 6. `X-Forwarded-For` fallback is client-controllable

Both `callerIp` (Worker) and `forwardedClientIp` (BFF) fall back to the first element of
`X-Forwarded-For`. Cloudflare **appends** to that header rather than replacing it, so its
first element is whatever the client sent. The comment claimed the opposite ("never from a
client-supplied value").

Not currently exploitable: `CF-Connecting-IP` is checked first and Cloudflare always sets
it on edge requests, so the fallback is only reached in local `next dev`. But it is a
latent full bypass of every IP-based limit if the app is ever fronted by a different proxy.
**Comment corrected** in both places to state the real trust boundary; the fallback is kept
for local development.

## [INFO] 7. Dependency advisories — cleared

`npm audit` reported 6 (3 high, 3 moderate): `undici`, `nanoid`, `brace-expansion`,
`miniflare`, `wrangler`, `@cloudflare/vitest-pool-workers`. All reached the tree through
`wrangler`/`vitest` as devDependencies — none ships to the Worker (which uses the runtime's
native `fetch`) or to the browser bundle, so there was no runtime exposure.

Reduced from 6 to 4:

- **`brace-expansion`** — cleared by a non-breaking `npm audit fix`.
- **`nanoid`** — sat below the advisory floor because the root `overrides` pins `next`'s
  `postcss` to 8.5.23. Rather than unpin `postcss` (that pin presumably exists for a
  reason), a targeted `nanoid: ^3.3.17` override lifts just the vulnerable package.

**The remaining 4 (`undici`, `miniflare`, `wrangler`, `@cloudflare/vitest-pool-workers`) are
deliberately left in place.** The only available fix is a semver-major bump to
`@cloudflare/vitest-pool-workers` 0.21, which **depends on zod v4**. This repo's contract
(`packages/shared`) is built on zod v3, so 0.21 puts both majors in the dependency tree at
once — and `tsc --noEmit` in `apps/api` then exhausts the heap and aborts (exit 134) even at
6 GB. That was verified by attempting the upgrade and measuring it, not assumed.

Trading a working typecheck and CI for four **dev-only** advisories with no runtime path is
the wrong trade: none of these packages ships to the Worker (which uses the runtime's native
`fetch`) or into the browser bundle. They are reachable only by someone who can already run
code in the build environment.

**Unblocked by**: migrating `packages/shared` to zod v4, after which the tooling bump is a
one-liner. Worth tracking as a maintenance task, not a security one.

### Related latent issue found while testing this

`apps/web` imports `zod` directly (`lib/api/types.ts`, `lib/realtime/types.ts`) but never
declared it as a dependency — it silently resolved whatever npm hoisted to the root. During
the upgrade attempt above, that meant the web app began type-checking its API contracts
against zod v4 while `packages/shared` built the same schemas on v3, producing real
validation failures in `lib/api/types.test.ts`. `zod: ^3.23.0` is now declared in
`apps/web/package.json` so the version is pinned to the contract's rather than to whatever a
devDependency happens to hoist.

---

## Verification of prior findings

The 2026-08 audit's fixes were re-checked against the current tree, not taken on trust:

| Prior finding | Verified |
|---|---|
| Global rate-limit bucket | ✅ Per-caller keys — **but see finding 1**: the fix left two routes uncovered |
| Turnstile fails open | ✅ `verifyTurnstile` throws when the secret is unset; dev bypass is a separate flag absent from `wrangler.toml` |
| Access tokens not revocable | ✅ `iat` + KV epoch enforced in `authMiddleware` — **but see finding 2**: one path was missed |
| PIN lockout non-atomic | ✅ Single atomic `UPDATE … RETURNING` with exponential backoff |
| Idempotency scoped to user only | ✅ Fingerprinted at both layers; DO-side check runs inside the serialized turn |
| Photo/export signing reuses `JWT_SECRET` | ✅ Separate `HMAC_SECRET`, fails closed |
| CSP allows inline scripts | ✅ Per-request nonce + `strict-dynamic`, no `unsafe-inline` in `script-src` |
| No CSRF defence | ✅ `crossOriginBlock` on all mutating BFF routes |
| JWT algorithm not pinned | ✅ `algorithms: ["HS256"]` + Zod-validated claims |

Two of the nine fixes were **incomplete in a way the original report's status line did not
capture**. Both gaps are the same shape: a control was added centrally, and a route that
predated or bypassed the central path kept the old behaviour. That is the pattern to watch
in future remediation.

---

## Positive observations

Things that were checked and found genuinely sound:

- **Tenant isolation.** Every repo function takes `familyId` as its first argument and
  every query filters on it. Cross-family object references are re-validated against the
  caller's family before use (e.g. `points/adjust`, `members/:id/photo`).
- **No SQL injection.** All dynamic SQL comes from whitelisted column maps
  (`SETTINGS_COLUMNS`) or generated `?` placeholders. No user string reaches a query body.
- **Double-spend protection is in the right place.** The KV idempotency middleware races by
  design (check-then-execute), but the FamilyRoom DO re-checks inside its serialized
  promise chain with a fingerprint, so concurrent duplicate submissions cannot double-credit
  points.
- **Signed URLs** use a dedicated secret, constant-time comparison, expiry validation, and
  a message binding family + object + verb, so a signature cannot be replayed across
  families or across upload/download.
- **EXIF stripping fails closed** — an image that cannot be safely stripped is deleted and
  marked `failed` rather than published.
- **Child privacy holds in the response shape**: `memberView` withholds emails and birth
  years from child viewers, and children are barred from the WebSocket entirely so they
  cannot observe siblings' point events.
- **CI supply chain**: all GitHub Actions are pinned to full commit SHAs.

---

## Recommendations

1. **Add a subject-scoped limit to every new public route** — treat the IP limit as
   best-effort. Worth a checklist item in `.claude/rules/api/routes.md`.
2. **Add an authz/abuse test per public route** the way `endpoint-scaffold` already requires
   one per authenticated route. Both high findings would have been caught by one.
3. **Treat "revoke what the old secret granted" as part of every credential change.**
   Findings 2 and 8 and the prior audit's session-revoke finding are all the same bug in
   different routes. Every such path in the current tree now revokes; the risk is the
   *next* one. Two cases do not exist yet but would need it the day they are added:
   changing a parent's email, and downgrading a co-parent's permissions (`full` →
   `approve_only`). Permissions are currently fixed at invite time and there is no route to
   change them, so a stale `perm` claim in a live token is not reachable today — but a
   downgrade route without a matching `revokeIssuedTokens` would silently leave the old
   privilege live for up to an hour.
4. **Migrate `packages/shared` to zod v4**, which unblocks the Cloudflare tooling bump and
   with it the last four dependency advisories.
5. **Confirm the invite semantics change** in finding 5 is what the product wants.
