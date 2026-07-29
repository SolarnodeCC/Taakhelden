-- 0007_instance_updated_at.sql — updated_at op task_instances voor de sync-delta (§3.11)
--
-- Formaat: ISO-8601 UTC met millis ("2026-01-31T12:00:00.000Z"), gelijk aan
-- new Date().toISOString() en aan de `since` die de client instuurt. Bewust NIET
-- datetime('now') (dat levert "YYYY-MM-DD HH:MM:SS"): dat sorteert lexicografisch
-- vóór elke ISO-waarde van hetzelfde moment (' ' < 'T'), waardoor rijen stil uit
-- de delta zouden vallen.
--
-- SQLite staat bij ADD COLUMN geen expressie-default toe, dus de kolom krijgt een
-- constante default en bestaande rijen worden hieronder gebackfilled.

ALTER TABLE task_instances
  ADD COLUMN updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';

UPDATE task_instances
   SET updated_at = COALESCE(
     approved_at,
     completed_at,
     strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
   );

CREATE INDEX idx_instances_family_updated ON task_instances(family_id, updated_at);
