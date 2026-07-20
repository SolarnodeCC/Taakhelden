-- 0002_seed_badges.sql — statische badge-catalogus (alleen positieve mijlpalen).
-- De toekenningslogica per id leeft in apps/api/src/services/badges.ts; deze
-- tabel levert alleen de weergavegegevens (titel/omschrijving/icoon). Houd de
-- id's in sync met BADGE_RULES.

INSERT OR IGNORE INTO badges (id, title, description, icon) VALUES
  ('first_task',    'Op weg!',            'Je hebt je eerste taak afgerond.',        'sparkles'),
  ('ten_tasks',     'Doorzetter',         'Al tien taken afgerond — knap gedaan!',   'rocket'),
  ('streak_5',      'Vlammetje',          'Vijf dagen op rij alles gedaan.',         'flame'),
  ('first_week',    'Eerste week vol!',   'Je haalde je allereerste weekbonus.',     'trophy'),
  ('homework_hero', 'Huiswerkkampioen',   'Tien keer je huiswerk afgerond.',         'book'),
  ('saver_250',     'Spaarkanjer',        'Samen 250 punten verzameld.',             'piggy-bank');
