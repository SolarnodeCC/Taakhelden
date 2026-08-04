-- 0009_child_pause.sql
-- WS-PAUSE: per-child rustschild (pause) — niet-punitief, geen ledger-impact.
-- Een pauze stopt instance-generatie en streak-gaten voor het betreffende kind.
-- Architectuurregel 4: nooit punten aftrekken door pauze.

CREATE TABLE child_pauses (
  id          TEXT PRIMARY KEY,
  family_id   TEXT NOT NULL REFERENCES families(id),
  child_id    TEXT NOT NULL REFERENCES users(id),
  starts_on   TEXT NOT NULL,          -- YYYY-MM-DD gezins-tijdzone
  ends_on     TEXT,                   -- NULL = open-eind tot ouder stopt
  reason      TEXT,                   -- optionele notitie van ouder (nooit kind-PII)
  created_by  TEXT NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  cleared_at  TEXT                    -- NULL = actief; gezet bij DELETE
);

CREATE INDEX idx_child_pauses_family_child ON child_pauses(family_id, child_id);
