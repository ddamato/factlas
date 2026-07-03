const ACCENT = '#3366FF';
const SPACING = { sm: 4, md: 8 };

export function Badge({ active }: { active: boolean }) {
  return (
    <span
      style={{
        color: ACCENT,
        backgroundColor: '#eee',
        padding: '2px',
        marginTop: 4,
        gap: SPACING.md,
        zIndex: 2,
        fontWeight: active ? 'bold' : 'normal',
      }}
    >
      badge
    </span>
  );
}
