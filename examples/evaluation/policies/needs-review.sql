-- needs-review: certainty routing (DOWNSTREAM.md §3). A value factlas could not
-- resolve statically (dynamic/unknown) is never silently passed or failed by the
-- value policies. It surfaces here as an informational note for a human — or, in
-- a fuller system, a gated Tier-2 LLM suite — to decide.
SELECT
  fact_id,
  file,
  line,
  col,
  'Unresolved ' || value_type || ' on "' || property || '" ('
    || certainty || ': ' || COALESCE(diagnostic, '') || ') needs review' AS message
FROM css_declaration
WHERE certainty IN ('dynamic', 'unknown')
ORDER BY file, line, col;
