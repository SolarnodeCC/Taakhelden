# Jankurai baseline (ratchet mode)

`.github/workflows/jankurai.yml` runs the official Jankurai action in
`mode: ratchet` against `agent/baselines/main.repo-score.json`. This file is
the accepted score snapshot; the workflow fails a PR only on a **regression**
against it, not on an absolute score target.

## What "regression" actually means

Read from `jankurai`'s own source (`crates/jankurai/src/audit/baseline.rs`,
`compare_report_to_baseline`) — this isn't documented in the README, so worth
recording here. Ratchet passes iff **all** of:

- `score_delta >= 0` — the new score is not lower than the baseline's.
- `new_caps.is_empty()` — no hard-rule caps apply that didn't already apply
  at baseline time.
- `new_hard_findings.is_empty()` — no `critical`/`high` finding **fingerprint**
  appears that wasn't already present at baseline time. Existing hard findings
  (this repo has 78 as of the baseline below — several are heuristic false
  positives, see `.github/workflows/jankurai.yml`) do **not** block; only new
  ones do.
- `policy_changed == false` — `agent/audit-policy.toml`'s fingerprint must
  match what the baseline was generated under.
- `version_compatible == true` — schema/standard version must match.

**Consequence: any edit to `agent/audit-policy.toml` invalidates the baseline.**
Regenerate the baseline in the same commit as any audit-policy.toml change, or
ratchet will fail with `policy_changed=true` regardless of score.

Separately, `agent/audit-policy.toml`'s own `minimum_score`/`fail_on` gate the
*advisory* decision itself (score floor + which severities block outright).
Both this policy check and the ratchet-vs-baseline check must pass. This repo
currently sets `fail_on = []` and a `minimum_score` well below the tool's
default of 85 — see the comment in `agent/audit-policy.toml` for why (the
default would make ratchet fail on day one, since no realistic repo starts at
a raw score of 85 without the tool's full, largely inapplicable, control-plane
scaffold — see the commit that added the four governance files).

## Why not the prebuilt binary

The release tarball's standalone `jankurai` binary bakes in a build-machine path
for its JSON schemas, so `jankurai audit` fails outside that machine with
`repo-score.schema.json: No such file or directory`. Always install **from a
source checkout** so the `schemas/` directory sits beside the crate — this is
what the CI action does internally (`cargo install --path .../crates/jankurai`).

## Regenerating the baseline

Whenever `agent/audit-policy.toml`, `agent/owner-map.json`, `agent/test-map.json`,
or `agent/generated-zones.toml` change, or whenever the team accepts a new
score (e.g. after fixing real findings), regenerate from a **clean, committed**
checkout — a dirty worktree score is not a trustworthy baseline
(`repo-score.json`'s own `dirty_worktree` field will say so):

```bash
git clone --depth 1 --branch v1.5.1 https://github.com/neverhuman/jankurai /tmp/jankurai-src
cargo install --path /tmp/jankurai-src/crates/jankurai --locked

# from a clean, committed checkout — no local edits:
git status --short   # must be empty
jankurai audit . --mode advisory \
  --json target/jankurai/repo-score.json \
  --md   target/jankurai/repo-score.md
cp target/jankurai/repo-score.json agent/baselines/main.repo-score.json
git add agent/baselines/main.repo-score.json
git commit -m "chore(jankurai): refresh ratchet baseline"
```

Sanity-check the new baseline actually passes ratchet against itself before
pushing:

```bash
jankurai audit . --mode ratchet --baseline agent/baselines/main.repo-score.json \
  --json /tmp/check.json --md /tmp/check.md
echo $?   # must be 0
```

Do **not** hand-edit `agent/baselines/main.repo-score.json` — always regenerate.
