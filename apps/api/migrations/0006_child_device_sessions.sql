-- 0006_child_device_sessions.sql — kind-device refresh tokens met revoke

CREATE TABLE child_device_sessions (
  id            TEXT PRIMARY KEY,
  family_id     TEXT NOT NULL REFERENCES families(id),
  child_id      TEXT NOT NULL REFERENCES users(id),
  token_hash    TEXT NOT NULL UNIQUE,
  expires_at    TEXT NOT NULL,
  last_used_at  TEXT,
  revoked_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_child_device_sessions_child
  ON child_device_sessions(family_id, child_id, revoked_at, expires_at);
