-- 0002_photos.sql — fotoflow (§3.6): upload-intent → upload → confirm → EXIF-strip → ready
-- R2-keys: task/{familyId}/{photoId} (lifecycle 30 d) · profile/{familyId}/{photoId} (uitgezonderd)

CREATE TABLE photos (
  id            TEXT PRIMARY KEY,                 -- ph_
  family_id     TEXT NOT NULL REFERENCES families(id),
  owner_id      TEXT NOT NULL REFERENCES users(id),  -- uploader: kind (taak) of ouder (profiel)
  purpose       TEXT NOT NULL CHECK (purpose IN ('task','profile')),
  ref_id        TEXT,                             -- instance-id (task) of member-id (profile)
  r2_key        TEXT NOT NULL,
  content_type  TEXT NOT NULL,
  bytes         INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'intent'
                -- intent → uploaded → processing → ready; failed = strip mislukt,
                -- object is dan verwijderd en de foto wordt nooit zichtbaar (privacyregel 5)
                CHECK (status IN ('intent','uploaded','processing','ready','failed')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_photos_family ON photos(family_id);
CREATE INDEX idx_photos_ref ON photos(family_id, ref_id);
