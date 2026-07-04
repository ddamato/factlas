// Tokens imported from the design system (a sibling folder). Cross-module, so the
// resolver — in-file only — leaves these unresolved at the use site below.
import { SPACE_SM, colors } from '../../../design-system/tokens';

export function Badge({ count, color }: { count: number; color?: string }) {
  const pad = SPACE_SM; // imported token → dynamic/unknown → needs-review

  return (
    <span
      style={{
        backgroundColor: '#EEE', // css.declaration (inline) literal color → #eeeeee
        padding: pad, // imported-token value → unresolved
        fontWeight: count > 0 ? 'bold' : 'normal', // static-union (norm: null)
        color: colors.danger, // cross-module member access → unknown
        borderColor: color, // runtime prop → dynamic
        WebkitBoxShadow: '0 0 2px #000', // vendor key → -webkit-box-shadow (shadow)
      }}
    >
      {count}
    </span>
  );
}
