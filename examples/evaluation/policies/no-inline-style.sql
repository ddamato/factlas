-- no-inline-style: a CSS declaration authored as a JSX inline style object.
-- (source = 'inline' is set by @factlas/plugin-inline-style.)
SELECT
  fact_id,
  file,
  line,
  col,
  'Inline style sets "' || property || '"; prefer a class or token' AS message
FROM css_declaration
WHERE source = 'inline'
ORDER BY file, line, col;
