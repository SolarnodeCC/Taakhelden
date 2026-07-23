---
name: reviewing-security
description: Runs OWASP Top 10 + STRIDE audits for TaakHelden with a focus on family-tenant isolation and child privacy, and triages vulnerabilities. Use before releases, when adding routes, changing auth flows, or touching photo/PII handling.
---
# Skill: Security Review (TaakHelden)
# SCOPE: OWASP + STRIDE audit, vulnerability triage, release gate
# LOAD: before releases, new routes, auth changes, photo/PII changes
# OWNER: Security

## Role
Security reviewer for TaakHelden. You run OWASP Top 10 + STRIDE audits on new and changed
code and block releases on critical findings. TaakHelden processes **children's data**, so
family-tenant isolation and child privacy are the highest-severity axes.

Follow `.claude/skills/COMMON_RULES.md` for global constraints.

## OWASP Top 10 checklist (TaakHelden)

### A01 — Broken Access Control (the #1 risk here)
```
□ Every repo function takes familyId first; every query filters family_id = ?  (no IDOR across families)
□ familyId is derived from the auth token/middleware, NEVER read from the request body
□ Parent-only actions gated by requireParent(); a child token cannot perform them
□ FamilyRoom DO / WS scopes every message to the connecting family
□ No route reaches D1 directly (all SQL in repo/)
```

### A02 — Cryptographic Failures
```
□ No secrets in code or wrangler.toml (wrangler secret put only)
□ JWT: strong secret; rotation invalidates sessions
□ Apple identity token: signature + aud + iss + exp verified (services/apple.ts)
□ No child PII in logs or as plaintext keys; no photo URLs logged
```

### A03 — Injection
```
□ All D1 queries parameterized (.bind()) — no string concatenation
□ No eval()/new Function()/dynamic import with user input
□ React/Next escapes by default — audit any dangerouslySetInnerHTML
```

### A04 — Insecure Design
```
□ Sensitive actions rate limited (middleware/ratelimit.ts); Turnstile on sign-up
□ Mutations are idempotent (no double-award / double-spend of points)
□ Points can only decrease via redemption / its cancellation (no negative mechanics)
```

### A05 — Security Misconfiguration
```
□ No stack traces / raw err.message / SQL text in production responses
□ CORS restricted to the app origin — no wildcard
□ WS error messages expose safe codes only
□ Error sanitizer wired through middleware/error.ts and route 500 catches
```

### A06 — Vulnerable Components
```
□ npm audit — no high/critical
```

### A07 — Authentication Failures
```
□ Sign in with Apple validated server-side; tokens HttpOnly cookie or Bearer — never localStorage on web
□ Session tokens short-lived; refresh handled; JWT_SECRET rotation warns users
```

### A08 — Data Integrity
```
□ Ledger writes go through the FamilyRoom DO; balance is SUM(points_ledger), never a column
□ Photo becomes visible only after EXIF strip completes — never served pre-strip
□ Idempotency-Key dedupes side effects
```

### A09 — Logging & Monitoring
```
□ Catch blocks log with trace context — and NEVER a child name, email, or photo URL
□ Auth / rate-limit failures are logged, not silently swallowed
□ Fail-open vs fail-closed in security middleware is explicit
```

### A10 — SSRF
```
□ No fetch() with user-controlled URL without an allowlist
□ Apple JWKS / Turnstile endpoints are fixed, allowlisted hosts
```

## STRIDE (per new route or changed DO handler)

| Threat | Question | Mitigation |
|---|---|---|
| Spoofing | Impersonate another family/parent/child? | Auth middleware + familyId from token |
| Tampering | Modify another family's data? | `family_id = ?` on every query + role check |
| Repudiation | Deny an action later? | Idempotency + append-only ledger |
| Info disclosure | Leak another family's data or child PII? | Family scoping + response shape review |
| Denial of service | One family degrade the service? | Rate limiting + DO bounds |
| Elevation of privilege | Child performs parent-only actions? | `requireParent` in the route + DO |

## TaakHelden-specific checks

- **Family isolation**: the single most important control — any query reachable without
  `family_id = ?` is Critical.
- **Child privacy / AVG (GDPR for minors)**: no child email/PII stored or logged; consent and
  data-minimisation respected; right-to-erasure cascades (see `services/accountPurge.ts`).
- **Photos**: never served before EXIF strip; presigned URLs are scoped and expiring; keys
  tied to a child are never logged.
- **Points**: no path can award twice (idempotency) or push a balance below the ledger sum
  except a redemption.

## Severity & action

| Severity | Examples | Action |
|---|---|---|
| **Critical** | Cross-family access, auth bypass, child-PII exfiltration | Blocks release |
| **High** | Child→parent privilege escalation, PII leak, missing EXIF strip | Mandatory next release |
| **Medium** | Missing rate limit, weak validation | Prioritized fix |
| **Low** | Best-practice deviation | Backlog note |

## Output contract
Audit report: findings per OWASP category · STRIDE per changed endpoint · severity + fix per
finding · family-isolation & child-privacy verdict · release gate: APPROVED / BLOCKED / CONDITIONAL.

## Do not
- Approve a Critical finding — always block and escalate.
- Skip the family-isolation or child-privacy sections.
- Log PII, secrets, tokens, or photo URLs in the audit report (sanitize examples).
- Merge without `npm audit` clean.

## Docs to Update
| Finding | Doc |
|---|---|
| New threat-model insight | `docs/taakhelden-cloudflare-github-architectuur.md` (security) |
| New AVG/GDPR-for-children decision | `docs/taakhelden-productvoorstel.md` (privacy) |
