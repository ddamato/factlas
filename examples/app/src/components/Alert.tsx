/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';

// Emotion css tag — literal declarations, no interpolation.
export const alertStyle = css`
  color: #B00020;
  background: #FDECEA;
  padding: 12px 16px;
  border-radius: 4px;
`;

// Renders the emotion style via the `css` prop (enabled by the jsxImportSource
// pragma above), so the app actually shows an alert.
export function Alert() {
  return <div css={alertStyle}>Heads up — something needs your attention.</div>;
}
