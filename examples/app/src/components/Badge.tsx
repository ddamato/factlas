import { SPACE_SM, colors } from '../tokens';

export function Badge({ count, color }: { count: number; color?: string }) {
  const pad = SPACE_SM; // one-hop const → resolvable to "4px"

  return (
    <span
      style={{
        backgroundColor: '#EEE', // literal
        padding: pad, // resolved literal
        fontWeight: count > 0 ? 'bold' : 'normal', // static-union
        color: colors.danger, // member access → unknown (not resolved)
        borderColor: color, // runtime prop → dynamic
      }}
    >
      {count}
    </span>
  );
}
