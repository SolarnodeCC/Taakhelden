-- Post-check for 0007_instance_updated_at: column + index exist; sentinel rows are gone.
SELECT 1
WHERE EXISTS (
  SELECT 1 FROM pragma_table_info('task_instances') WHERE name = 'updated_at'
)
AND EXISTS (
  SELECT 1 FROM pragma_index_list('task_instances') WHERE name = 'idx_instances_family_updated'
);
