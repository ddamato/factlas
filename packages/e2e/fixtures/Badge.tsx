const ACCENT = '#3366FF';

export function Badge({ active }: { active: boolean }) {
  return (
    <span
      style={{
        color: ACCENT,
        backgroundColor: '#eee',
        padding: '2px',
        fontWeight: active ? 'bold' : 'normal',
      }}
    >
      badge
    </span>
  );
}
