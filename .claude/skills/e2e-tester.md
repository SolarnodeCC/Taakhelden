---
name: e2e-testing
description: E2E (Playwright against the Next.js dashboard), load (k6), stress (FamilyRoom DO), and a11y (axe-core) test patterns for TaakHelden. Use when writing browser-level specs, load scenarios, DO concurrent stress tests, or WCAG audits.
---
# Skill: E2E, Load, Stress & A11y Testing (TaakHelden)
# SCOPE: tests/e2e/, tests/load/, tests/stress/, tests/a11y/
# LOAD: when writing E2E/load/stress/a11y tests or debugging Playwright CI failures
# OWNER: QA

## Role
E2E & Performance QA engineer for TaakHelden. You write browser, load, stress, and
accessibility tests — not implementation code. Unit/integration tests (`apps/api/test/`) are
owned by `taakhelden-tester` — do not overlap.

## Test infrastructure

```
tests/e2e/      # Playwright specs against the Next.js parent dashboard (apps/web)
tests/load/     # k6 scripts (run with the k6 CLI)
tests/stress/   # FamilyRoom DO concurrency (many simultaneous ledger writes for one family)
tests/a11y/     # axe-core WCAG 2.1 AA audits
```

Chromium is preinstalled (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`) — never run
`playwright install`.

```bash
npx playwright test                 # E2E against a running dashboard
k6 run tests/load/k6-smoke.js -e BASE_URL=<url>
npm test -- tests/stress/           # FamilyRoom stress
npm test -- tests/a11y/             # component a11y
```

## The core loop to exercise

The one flow that must always have E2E coverage:

**parent creates a task → child completes it → points land in the ledger → parent sees the
new balance → child redeems a reward → balance decreases by exactly the reward cost.**

```typescript
import { test, expect } from '@playwright/test'

test.describe('kernlus (core loop)', () => {
  test('taak → afronden → punten → beloning inwisselen', async ({ page }) => {
    await test.step('ouder maakt een taak', async () => { /* … */ })
    await test.step('kind vinkt de taak af', async () => { /* … */ })
    await test.step('punten verschijnen in het saldo', async () => {
      await expect(page.getByRole('status', { name: /punten/i })).toContainText('10')
    })
    await test.step('kind wisselt een beloning in', async () => { /* … */ })
  })
})
```

## Selectors (resilience order — stop at the first that works)

```typescript
page.getByRole('button', { name: /taak toevoegen/i })   // 1. accessible role
page.getByLabel('Titel van de taak')                    // 2. label
page.getByText('Nog 2 taken te gaan!')                  // 3. visible text
page.getByTestId('reward-redeem')                       // 4. test id (last resort)
// ✗ never page.$('.btn-primary')
```

## Invariants to prove in the browser

- **Cross-family isolation**: a parent from family A never sees family B's tasks/children.
- **Ledger truth**: the balance shown equals the API's ledger sum; redeeming subtracts exactly the cost.
- **Idempotency in the UI**: a double-tap / retry on "afronden" awards points once.
- **Positive tone**: assert child-facing copy is encouraging (no "mislukt"/"te laat"/"fout").

## FamilyRoom DO stress

```typescript
import { describe, it, expect } from 'vitest'
describe('FamilyRoom concurrent ledger writes', () => {
  it('N simultaneous task completions for one family: balance = SUM(ledger), no drops', async () => {
    // drive many concurrent awardPoints for the same familyId; assert the ledger sum is exact
  }, 30_000)   // always an explicit timeout ≥ 10_000ms
})
```

## k6 smoke

```javascript
import http from 'k6/http'; import { check, sleep } from 'k6'
export const options = {
  vus: 10, duration: '30s',
  thresholds: { http_req_failed: ['rate<0.05'], http_req_duration: ['p(95)<500'] },
}
export default function () {
  const res = http.get(`${__ENV.BASE_URL}/api/tasks`)
  check(res, { 'status 200': (r) => r.status === 200 }); sleep(1)
}
```

## A11y (axe-core, WCAG 2.1 AA)

```typescript
import { axe, toHaveNoViolations } from 'jest-axe'
expect.extend(toHaveNoViolations)
it('dashboard page has no WCAG 2.1 AA violations', async () => {
  const { container } = render(<TasksPage />)
  expect(await axe(container, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa'] } })).toHaveNoViolations()
})
```

Checklist per new page: `alt` on images, `aria-label` on icon-only buttons, labels on
inputs, ≥4.5:1 contrast, logical tab order, `role="alert"`/`aria-live` on errors, ≥44px targets.

## Prove-it for bugs
Write the failing E2E/stress/k6 test first (it must fail on current code), capture the
failure, report "ready for fix" — don't touch the implementation.

## Anti-patterns
`page.waitForTimeout()` → use web-first `expect(locator).toBeVisible()`. Raw CSS selectors →
use the hierarchy. Shared state across tests → each test seeds its own family. Never mock a
real external call by hitting it — use `page.route()`.

## Docs to Update
| Change | Doc |
|---|---|
| New Playwright/k6 config | `tests/` README + `docs/taakhelden-cloudflare-github-architectuur.md` (CI) |
| FamilyRoom stress characteristics | `docs/taakhelden-cloudflare-github-architectuur.md` |
