-- 0005_account_exports.sql — asynchrone data-export (AVG art. 20)
-- Eén rij per export-job; het ZIP-bestand (JSON + foto's) leeft in R2 onder
-- export/<family_id>/<id>.zip. De rij houdt alleen status + metadata bij.

CREATE TABLE account_exports (
  id          TEXT PRIMARY KEY,
  family_id   TEXT NOT NULL REFERENCES families(id),
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','ready','failed')),
  r2_key      TEXT,                                 -- gezet zodra klaar
  byte_size   INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  ready_at    TEXT
);
CREATE INDEX idx_account_exports_family ON account_exports(family_id);
