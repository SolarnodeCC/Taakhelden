-- Post-check for 0010_idempotency_fingerprint.
SELECT 1
WHERE EXISTS (
  SELECT 1 FROM pragma_table_info('idempotency_keys') WHERE name = 'fingerprint'
);
