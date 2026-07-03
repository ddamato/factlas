// @factlas/plugin-styled — css.declaration (source: css-in-js).
// Tag recognition is import-aware.
import styled from 'styled-components';
import { css } from '@emotion/react';

const color = '#3366FF';

// styled.tag — literal + interpolated declarations, nested selector, media.
export const Box = styled.div`
  color: #FFFFFF; /*            literal → #ffffff        */
  background: ${color}; /*      interpolation → dynamic  */
  padding: 8px; /*             literal → 8px            */

  &:hover {
    color: #2851d6; /*         selector: '&:hover'      */
  }

  @media (min-width: 600px) {
    padding: 16px; /*          media: '(min-width: 600px)' */
  }
`;

// styled(Component) — owner_component: 'BigBox'
export const BigBox = styled(Box)`
  padding: 24px;
`;

// emotion css tag
export const alertStyle = css`
  color: #b00020;
`;

// NOT imported from a CSS-in-JS package → ignored (no facts).
const notStyled = { div: (_s: TemplateStringsArray) => null };
export const Ignored = notStyled.div`color: red;`;
