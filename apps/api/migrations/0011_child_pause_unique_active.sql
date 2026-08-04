-- Unique active pause per (family, child, starts_on) — prevents duplicate rows on retry.
-- Partial index: only rows that are not yet cleared.
CREATE UNIQUE INDEX IF NOT EXISTS uq_child_pauses_active
  ON child_pauses(family_id, child_id, starts_on)
  WHERE cleared_at IS NULL;
