# Jankurai merge-witness baseline

The advisory workflow (`.github/workflows/jankurai.yml`) runs a merge-witness
step **only if** `agent/baselines/main.repo-score.json` exists here. Until it's
committed, the witness step is skipped (no failure) and the rest of the audit
still runs.

## Establishing the baseline (one-time)

Run the canonical full audit against `main` and commit its score as the baseline:

```bash
# install jankurai v1.5.1 (checksum-verified) — same as the workflow does
asset="jankurai-1.5.1-x86_64-unknown-linux-gnu.tar.gz"
curl -fsSL "https://github.com/neverhuman/jankurai/releases/download/v1.5.1/${asset}" -o "$asset"
echo "a12dbb4a3805dee807fc101d4b073ac9386936b33c5579f606a655fe90d0bbac  ${asset}" | sha256sum -c -
tar -xzf "$asset" && sudo install -m 0755 jankurai-1.5.1-*/jankurai /usr/local/bin/jankurai

# from a clean checkout of main:
jankurai audit . --mode advisory \
  --json target/jankurai/repo-score.json \
  --md   target/jankurai/repo-score.md

mkdir -p agent/baselines
cp target/jankurai/repo-score.json agent/baselines/main.repo-score.json
git add agent/baselines/main.repo-score.json
git commit -m "chore(jankurai): establish merge-witness baseline from main"
```

Refresh the baseline whenever you want the witness to measure against a newer
`main` (e.g. after a large merge). Do **not** hand-edit the JSON — regenerate it.

> Note: this session could not generate the baseline automatically — the
> sandbox's auto-mode classifier blocked executing the Jankurai binary, so the
> bootstrap above must be run in an environment where `jankurai` may execute.
