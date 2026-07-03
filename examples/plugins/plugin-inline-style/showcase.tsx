// @factlas/plugin-inline-style — css.declaration (source: inline) from style={{}}.
// Property keys are canonicalized to kebab-case by core.

const brand = '#3366FF';

export function Showcase({ color }: { color?: string }) {
  return (
    <div
      style={{
        backgroundColor: '#EEE', //   background-color, literal color → #eeeeee
        padding: '4px', //            padding, literal length → 4px
        color: brand, //              one-hop const → literal #3366ff
        fontWeight: color ? 'bold' : 'normal', // static-union (norm: null)
        borderColor: color, //        runtime prop → dynamic (norm: null)
        WebkitBoxShadow: '0 0 2px #000', // vendor prefix → -webkit-box-shadow
      }}
    />
  );
}

// A fully dynamic style object → diagnostic 'dynamic-style-object', no facts.
export const Dynamic = (s: object) => <div style={s} />;
