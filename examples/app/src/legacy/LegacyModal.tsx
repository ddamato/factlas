// A legacy internal component kept for backwards compatibility. App imports it
// to show an ordinary local `import` fact (the specifier is a relative path).
export function LegacyModal({ open }: { open: boolean }) {
  if (!open) return null;
  return <div role="dialog">Legacy modal</div>;
}
