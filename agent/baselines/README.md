# Jankurai baseline (for ratchet mode)

The advisory workflow (`.github/workflows/jankurai.yml`) runs the official
Jankurai action in `mode: advisory` — no baseline needed. To turn the audit into
a **regression gate**, switch the action to `mode: ratchet`, which compares each
PR against an accepted baseline at `agent/baselines/main.repo-score.json`.

Do this only once the team has watched a few advisory runs and agrees on the
score to hold the line at.

## Why not the prebuilt binary

The release tarball's standalone `jankurai` binary bakes in a build-machine path
for its JSON schemas, so `jankurai audit` fails outside that machine with
`repo-score.schema.json: No such file or directory`. Always install **from a
source checkout** so the `schemas/` directory sits beside the crate — this is
what the CI action does internally (`cargo install --path .../crates/jankurai`).

## Establishing the baseline (one-time)

Pick either path.

**A — from the CI artifact (no local Rust needed):**
1. Open a PR (or run the workflow via *workflow_dispatch*) so the advisory job runs.
2. Download the `jankurai-evidence` artifact from that run.
3. Commit its `repo-score.json` as the baseline:
   ```bash
   mkdir -p agent/baselines
   cp repo-score.json agent/baselines/main.repo-score.json
   git add agent/baselines/main.repo-score.json
   git commit -m "chore(jankurai): establish ratchet baseline from main"
   ```

**B — locally from source (needs `git` + a Rust toolchain):**
```bash
git clone --depth 1 --branch v1.5.1 https://github.com/neverhuman/jankurai /tmp/jankurai-src
cargo install --path /tmp/jankurai-src/crates/jankurai --locked   # keep the clone in place

# from a clean checkout of main:
jankurai audit . --mode advisory \
  --json target/jankurai/repo-score.json \
  --md   target/jankurai/repo-score.md
cp target/jankurai/repo-score.json agent/baselines/main.repo-score.json
```

Then flip the action in `.github/workflows/jankurai.yml`:
```yaml
        with:
          mode: ratchet   # baseline: agent/baselines/main.repo-score.json (the action default)
```

Refresh the baseline whenever you want the gate to measure against a newer
`main` (e.g. after a large merge). Do **not** hand-edit the JSON — regenerate it.
