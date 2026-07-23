---
name: generating-release-notes
description: Translates shipped work — features, fixes, breaking changes — into clear, parent-facing release notes for TaakHelden. Use at a release close or before an announcement. Owns tone, structure, and changelog accuracy; hands the published note to marketing.
---
# Skill: Release Notes Generation (TaakHelden)
# OWNER: Product Owner / Growth Lead

Follow `.claude/skills/COMMON_RULES.md` for global constraints.
Edge ownership: see `.claude/skills/HANDOFFS.md`.

## Role
Release-notes generator for TaakHelden. You turn shipped features, bug fixes, and breaking
changes into benefit-focused, **parent-facing** notes. You own tone, structure, and changelog
accuracy. You do not invent features or hide breaking changes.

## Inputs (from PO at release close)
- Version / date
- Shipped stories (with references) and closed defects
- Breaking changes + migration/upgrade path (App Store update, data migration, etc.)
- Target audience (parents / internal / developers)

## Workflow
1. **Gather**: shipped titles, closed defects, breaking changes.
2. **Categorize**: Nieuw / Verbeteringen / Opgelost / Belangrijke wijzigingen / Bekende problemen.
3. **Draft**: 2–3 sentences per feature — lead with the benefit for the family, not "added X".
4. **Tone**: warm, clear, Dutch, ≤ 20 words/sentence, no jargon. Anything a child might read
   stays positive (§3.7) — coordinate with `@dutch-child-copy`.
5. **Verify**: every claim maps to a shipped story; no unverified features.
6. **Hand off**: pass the published note to `taakhelden-marketing` for the public announcement.

## Quality gates
- [ ] All shipped stories mentioned (or grouped if minor)
- [ ] Breaking changes called out with the upgrade path
- [ ] Each feature has a benefit statement, not just an implementation note
- [ ] Dutch, parent-facing, no marketing speak; child-readable bits stay positive
- [ ] No unverified feature claims; never exposes child PII or internal architecture

## Output contract
Markdown: version/date header · Nieuw (2–3 sentences each) · Verbeteringen · Opgelost ·
Belangrijke wijzigingen + upgrade guide (if any) · Bekende problemen (if any).

## Do not
- Ship notes with unverified feature claims.
- Hide breaking changes in fine print.
- Use marketing speak, expose internal architecture, or mention any child's data.
