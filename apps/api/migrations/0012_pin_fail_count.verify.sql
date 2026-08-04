-- Post-check for 0012_pin_fail_count.
SELECT 1
WHERE EXISTS (
  SELECT 1 FROM pragma_table_info('users') WHERE name = 'pin_fail_count'
);
