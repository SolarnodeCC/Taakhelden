-- Post-check for 0014_proposal_review_flag.
SELECT 1
WHERE EXISTS (
  SELECT 1 FROM pragma_table_info('task_proposals') WHERE name = 'review_flag'
);
