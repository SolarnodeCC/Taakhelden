-- 0008_avatar_catalog_and_family_goals.sql
-- Phase 3 slices 3c/3e: avatar-shop catalogus + equipped slots, coöperatieve gezinsdoelen.
-- Unlock van avatar-items is afgeleid (lifetime/level/badge) — geen ledger-spend.
-- Gezinsdoel-progress = som van positieve ledger sinds started_at (nooit huidig saldo).

CREATE TABLE avatar_catalog (
  id                TEXT PRIMARY KEY,
  slot              TEXT NOT NULL CHECK (slot IN ('hat', 'background', 'accessory')),
  unlock_type       TEXT NOT NULL CHECK (unlock_type IN ('level', 'badge', 'lifetimePoints')),
  unlock_threshold  INTEGER NOT NULL DEFAULT 0,
  unlock_badge_id   TEXT,
  preview_emoji     TEXT NOT NULL,
  title             TEXT NOT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO avatar_catalog
  (id, slot, unlock_type, unlock_threshold, unlock_badge_id, preview_emoji, title, sort_order)
VALUES
  ('hat_starter',       'hat',         'level',          1,   NULL,          '🎩', 'Starterhoed',     10),
  ('hat_level3',        'hat',         'level',          3,   NULL,          '🧢', 'Heldenpet',       20),
  ('hat_level5',        'hat',         'level',          5,   NULL,          '👑', 'Kroon',           30),
  ('bg_cream',          'background',  'level',          1,   NULL,          '🟨', 'Zonnig',          10),
  ('bg_sky',            'background',  'level',          2,   NULL,          '🟦', 'Lucht',           20),
  ('bg_first_week',     'background',  'badge',          0,   'first_week',  '🏆', 'Eerste week',     30),
  ('acc_sparkle',       'accessory',   'lifetimePoints', 50,  NULL,          '✨', 'Sprankels',       10),
  ('acc_star',          'accessory',   'lifetimePoints', 200, NULL,          '⭐', 'Ster',            20);

ALTER TABLE users ADD COLUMN equipped_hat TEXT;
ALTER TABLE users ADD COLUMN equipped_background TEXT;
ALTER TABLE users ADD COLUMN equipped_accessory TEXT;

CREATE TABLE family_goals (
  id              TEXT PRIMARY KEY,
  family_id       TEXT NOT NULL REFERENCES families(id),
  title           TEXT NOT NULL,
  icon            TEXT NOT NULL DEFAULT '🎯',
  target_points   INTEGER NOT NULL CHECK (target_points > 0),
  child_ids_json  TEXT,  -- JSON array; NULL of [] = alle kinderen
  started_at      TEXT NOT NULL,
  completed_at    TEXT,
  status          TEXT NOT NULL CHECK (status IN ('active', 'completed', 'archived'))
                  DEFAULT 'active',
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_family_goals_family_status ON family_goals(family_id, status);
