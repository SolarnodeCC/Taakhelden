-- 0003_notification_settings.sql — per-kind notificatie-instellingen (§3.10).
-- Ontbrekende rij = standaard: aan, gezinsvenster (quiet hours) overnemen.

CREATE TABLE notification_settings (
  child_id    TEXT PRIMARY KEY REFERENCES users(id),
  enabled     INTEGER NOT NULL DEFAULT 1,
  quiet_start TEXT,                               -- NULL = neem gezinsvenster over
  quiet_end   TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
