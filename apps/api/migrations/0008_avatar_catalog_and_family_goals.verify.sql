-- Post-check for 0008_avatar_catalog_and_family_goals.
SELECT 1
WHERE EXISTS (
  SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'avatar_catalog'
)
AND EXISTS (
  SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'family_goals'
)
AND EXISTS (
  SELECT 1 FROM pragma_table_info('users') WHERE name = 'equipped_hat'
)
AND EXISTS (
  SELECT 1 FROM pragma_index_list('family_goals') WHERE name = 'idx_family_goals_family_status'
);
