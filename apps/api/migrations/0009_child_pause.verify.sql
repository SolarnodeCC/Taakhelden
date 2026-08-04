-- Post-check for 0009_child_pause.
SELECT 1
WHERE EXISTS (
  SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'child_pauses'
)
AND EXISTS (
  SELECT 1 FROM pragma_index_list('child_pauses') WHERE name = 'idx_child_pauses_family_child'
);
