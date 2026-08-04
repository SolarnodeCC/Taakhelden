SELECT COUNT(*) AS ok
FROM sqlite_master
WHERE type = 'index' AND name = 'uq_child_pauses_active';
