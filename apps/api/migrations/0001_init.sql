-- 0001_init.sql — kern-datamodel TaakHelden
-- Conventie: id's zijn tekst met prefix (fam_, usr_, ch_ via role, tsk_, ti_, rw_, rd_, pl_)

CREATE TABLE families (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  invite_code   TEXT NOT NULL UNIQUE,
  timezone      TEXT NOT NULL DEFAULT 'Europe/Amsterdam',
  quiet_start   TEXT NOT NULL DEFAULT '19:30',   -- geen kind-notificaties na dit tijdstip
  quiet_end     TEXT NOT NULL DEFAULT '07:00',
  day_bonus_points   INTEGER NOT NULL DEFAULT 20,
  week_bonus_points  INTEGER NOT NULL DEFAULT 100,
  week_bonus_threshold REAL NOT NULL DEFAULT 0.8, -- 80% van weektaken = weekbonus
  vacation_mode INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at    TEXT                              -- soft delete (7 dagen venster)
);

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  family_id     TEXT NOT NULL REFERENCES families(id),
  role          TEXT NOT NULL CHECK (role IN ('parent','child')),
  permissions   TEXT NOT NULL DEFAULT 'full'      -- parent: full | approve_only
                CHECK (permissions IN ('full','approve_only')),
  display_name  TEXT NOT NULL,                    -- roepnaam
  email         TEXT UNIQUE,                      -- alleen parents; NULL voor kinderen
  password_hash TEXT,                             -- alleen parents (of NULL bij Apple-only)
  apple_sub     TEXT UNIQUE,                      -- Sign in with Apple subject
  birth_year    INTEGER,                          -- alleen kinderen (geen geboortedatum: dataminimalisatie)
  age_mode      TEXT CHECK (age_mode IN ('young','mid','teen')),
  avatar_id     TEXT,
  photo_key     TEXT,                             -- R2-key profielfoto (optioneel)
  pincode_hash  TEXT,                             -- alleen kinderen (argon2)
  pin_locked_until TEXT,
  consent_by    TEXT REFERENCES users(id),        -- AVG art. 8: welke ouder gaf toestemming
  consent_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at    TEXT
);
CREATE INDEX idx_users_family ON users(family_id);

CREATE TABLE refresh_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  revoked_at  TEXT
);

CREATE TABLE tasks (
  id            TEXT PRIMARY KEY,
  family_id     TEXT NOT NULL REFERENCES families(id),
  title         TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'household'
                CHECK (category IN ('household','homework','selfcare','custom')),
  icon          TEXT NOT NULL DEFAULT 'star',
  points        INTEGER NOT NULL CHECK (points > 0),
  photo_bonus_points INTEGER NOT NULL DEFAULT 0 CHECK (photo_bonus_points >= 0),
  approval_required  INTEGER NOT NULL DEFAULT 0,
  assignees     TEXT NOT NULL DEFAULT '[]',       -- JSON array van child user_ids
  rotation      TEXT,                             -- JSON array; overschrijft assignees per week
  recurrence    TEXT,                             -- JSON: {freq, days?} — NULL = eenmalig
  daypart       TEXT CHECK (daypart IN ('morning','afternoon','evening')),
  active_from   TEXT,
  active_until  TEXT,
  archived_at   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_tasks_family ON tasks(family_id);

CREATE TABLE task_instances (
  id            TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL REFERENCES tasks(id),
  family_id     TEXT NOT NULL REFERENCES families(id),  -- gedenormaliseerd voor scoping
  child_id      TEXT NOT NULL REFERENCES users(id),
  date          TEXT NOT NULL,                    -- YYYY-MM-DD in gezins-tijdzone
  status        TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','completed','submitted','open_redo','approved')),
  photo_key     TEXT,
  photo_status  TEXT CHECK (photo_status IN ('processing','ready')),
  points_earned INTEGER,
  redo_note     TEXT,                             -- vriendelijke toelichting van ouder
  completed_at  TEXT,
  approved_at   TEXT,
  approved_by   TEXT REFERENCES users(id),
  UNIQUE (task_id, child_id, date)
);
CREATE INDEX idx_instances_family_date ON task_instances(family_id, date);
CREATE INDEX idx_instances_child_date ON task_instances(child_id, date);

CREATE TABLE points_ledger (
  id          TEXT PRIMARY KEY,
  family_id   TEXT NOT NULL REFERENCES families(id),
  child_id    TEXT NOT NULL REFERENCES users(id),
  type        TEXT NOT NULL
              CHECK (type IN ('task','photo_bonus','day_bonus','week_bonus',
                              'redemption','redemption_cancel','adjustment','badge')),
  amount      INTEGER NOT NULL,                   -- negatief alleen bij redemption
  ref_id      TEXT,                               -- instance/redemption/badge id
  note        TEXT,                               -- verplicht bij adjustment
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_ledger_child ON points_ledger(child_id, created_at);

CREATE TABLE rewards (
  id            TEXT PRIMARY KEY,
  family_id     TEXT NOT NULL REFERENCES families(id),
  title         TEXT NOT NULL,
  icon          TEXT NOT NULL DEFAULT 'gift',
  price         INTEGER NOT NULL CHECK (price > 0),
  limit_per_week INTEGER,
  archived_at   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE redemptions (
  id          TEXT PRIMARY KEY,
  family_id   TEXT NOT NULL REFERENCES families(id),
  reward_id   TEXT NOT NULL REFERENCES rewards(id),
  child_id    TEXT NOT NULL REFERENCES users(id),
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','fulfilled','cancelled')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  handled_at  TEXT,
  handled_by  TEXT REFERENCES users(id)
);

CREATE TABLE pinned_rewards (
  child_id  TEXT PRIMARY KEY REFERENCES users(id),  -- max 1 spaardoel per kind
  reward_id TEXT NOT NULL REFERENCES rewards(id),
  pinned_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE badges (
  id          TEXT PRIMARY KEY,                   -- statische catalogus, geseed
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  icon        TEXT NOT NULL
);

CREATE TABLE child_badges (
  child_id  TEXT NOT NULL REFERENCES users(id),
  badge_id  TEXT NOT NULL REFERENCES badges(id),
  earned_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (child_id, badge_id)
);

CREATE TABLE devices (
  apns_token  TEXT NOT NULL,
  user_id     TEXT NOT NULL REFERENCES users(id),
  platform    TEXT NOT NULL DEFAULT 'ios',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (apns_token, user_id)               -- gedeelde iPad: token ↔ meerdere profielen
);

CREATE TABLE idempotency_keys (
  key         TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  response    TEXT NOT NULL,                      -- gecachte JSON-response
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
