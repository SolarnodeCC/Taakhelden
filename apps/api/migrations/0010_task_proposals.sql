-- 0010_task_proposals.sql
-- WS-PROPOSAL: Taakvraag — een tiener stelt een taak voor, een ouder keurt die
-- goed tot een echte taak of wijst hem vriendelijk af.
--
-- Architectuurregel 3/4: een taakvraag raakt het ledger NOOIT. Punten stromen
-- pas via de normale taak → afvinken → goedkeuren-route nadat de ouder de vraag
-- heeft goedgekeurd en er dus een echte taak bestaat.
--
-- `decision_note` is de vriendelijke toelichting van de ouder bij afwijzen
-- (nooit kind-PII); `note` is de motivatie van het kind zelf.

CREATE TABLE task_proposals (
  id               TEXT PRIMARY KEY,
  family_id        TEXT NOT NULL REFERENCES families(id),
  child_id         TEXT NOT NULL REFERENCES users(id),   -- indiener (tiener)
  title            TEXT NOT NULL,
  category         TEXT NOT NULL DEFAULT 'household'
                   CHECK (category IN ('household','homework','selfcare','custom')),
  icon             TEXT NOT NULL DEFAULT 'star',
  suggested_points INTEGER NOT NULL CHECK (suggested_points > 0),
  note             TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','declined')),
  decided_by       TEXT REFERENCES users(id),
  decided_at       TEXT,
  decision_note    TEXT,                                 -- vriendelijke toelichting bij afwijzen
  created_task_id  TEXT REFERENCES tasks(id),
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_proposals_family_status ON task_proposals(family_id, status);
CREATE INDEX idx_proposals_family_child ON task_proposals(family_id, child_id);
