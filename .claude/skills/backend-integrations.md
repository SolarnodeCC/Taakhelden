---
name: integrating-backend-services
description: External integration patterns for the TaakHelden backend — Sign in with Apple, JWT sessions, Turnstile, R2 photo uploads with EXIF strip, and transactional email. Use when implementing or debugging auth, bot protection, photo handling, or email.
---

Follow `.claude/skills/COMMON_RULES.md` for global constraints.

Referenced from [backend-dev.md](backend-dev.md). Load when working on external service
integrations. TaakHelden uses **no** third-party payment, LLM, or SSO provider — the
integration surface is Apple auth, Turnstile, R2, and email.

## Sign in with Apple + JWT sessions

```typescript
// services/apple.ts verifies the Apple identity token (JWKS, aud, iss, exp).
// services/jwt.ts mints/verifies the TaakHelden session token.
const apple = await verifyAppleIdentityToken(c.env, idToken)   // throws on bad signature/claims
const session = await issueSession(c.env, { userId, role: 'parent' })  // JWT, short-lived
```

Rules: verify signature + claims with SubtleCrypto (no Node `crypto`); never trust
client-supplied identity fields; `JWT_SECRET` rotation invalidates all sessions (coordinate
with devops). Never log tokens or child PII.

## Turnstile (bot protection)

```typescript
// services/turnstile.ts — verify the Turnstile token on sign-up / sensitive actions
const ok = await verifyTurnstile(c.env.TURNSTILE_SECRET, token, c.req.header('CF-Connecting-IP'))
if (!ok) return fail(c, ErrorCodes.TURNSTILE_FAILED, 403)
```

Define a timeout + a safe degradation decision; log failures with trace context (no PII).

## R2 photo uploads (EXIF strip before visible)

```typescript
// Presigned upload → queue/consumer strips EXIF → only then is the photo visible.
// services/photoService.ts + jobs/photoConsumer.ts + services/exif.ts
const { url, key } = await presignUpload(c.env, familyId)      // scoped, expiring URL
// ... client uploads to R2 ...
// consumer: strip EXIF, mark visible. NEVER expose the raw pre-strip object.
```

Rules (hard-rule #5): a photo is **never** shown before EXIF strip. R2 bucket is `eu` with a
30-day lifecycle. Never log photo URLs or object keys tied to a child.

## Transactional email

```typescript
// services/email.ts + services/notifier.ts — parent-facing only
await sendEmail(c.env, { to: parentEmail, subject, html })     // never to a child address
```

Rules: **no child e-mail/PII** (hard-rule #5) — email is a parent channel only. Don't tell a
caller mail was delivered if the send failed unless the contract means "accepted"; log
failures with trace context and offer a safe retry.

## External dependency checklist

- [ ] Timeout defined
- [ ] Retry or no-retry rationale documented
- [ ] Graceful-degradation behavior for user-facing paths
- [ ] Idempotency/dedupe key for any side effect
- [ ] Structured log includes trace id and sanitized context — **never** a name, e-mail, token, or photo URL
