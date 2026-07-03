-- color-off-token: a literal color that is not one of the allowed tokens.
--
-- Restricted to certainty = 'literal': a value factlas could not fully resolve
-- must never be *failed* against an allowed-set (it might well be a token). Those
-- are routed to `needs-review` instead. This is the ADR's certainty rule in SQL.
SELECT
  fact_id,
  file,
  line,
  col,
  'Color ' || norm || ' on "' || property || '" is not a design token' AS message
FROM css_declaration
WHERE value_type = 'color'
  AND certainty = 'literal'
  AND norm NOT IN (SELECT norm FROM ref_allowed_colors)
ORDER BY file, line, col;
