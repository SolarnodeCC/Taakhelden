-- Post-check for 0010_task_proposals.
SELECT 1
WHERE EXISTS (
  SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'task_proposals'
)
AND EXISTS (
  SELECT 1 FROM pragma_index_list('task_proposals') WHERE name = 'idx_proposals_family_status'
)
AND EXISTS (
  SELECT 1 FROM pragma_index_list('task_proposals') WHERE name = 'idx_proposals_family_child'
)
AND (
  SELECT COUNT(*) FROM pragma_table_info('task_proposals')
  WHERE name IN ('family_id', 'child_id', 'suggested_points', 'status', 'decision_note', 'created_task_id')
) = 6;
