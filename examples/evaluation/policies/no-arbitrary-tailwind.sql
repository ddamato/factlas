-- no-arbitrary-tailwind: a Tailwind class using an arbitrary bracketed value
-- (e.g. text-[#123456], w-[13px]) instead of a value from the configured scale.
SELECT
  fact_id,
  file,
  line,
  col,
  'Arbitrary Tailwind class "' || token || '" bypasses the token scale' AS message
FROM css_class
WHERE is_arbitrary = 1
ORDER BY file, line, col;
