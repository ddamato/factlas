import styled from 'styled-components';
// The app consumes the design system's token binding (a sibling folder). Because
// the resolver never crosses a module boundary, BRAND is not resolved here — the
// styled interpolation below is dynamic regardless.
import { BRAND } from '../../../design-system/tokens';

const accent = BRAND;

export const Button = styled.button`
  color: #FFFFFF;
  background: ${accent};
  padding: 4px 8px;
  border-radius: 8px;

  &:hover {
    background: #2851d6;
  }

  @media (min-width: 768px) {
    padding: 8px 16px;
  }
`;

export const Ghost = styled(Button)`
  color: ${(p) => p.theme.text};
  background: transparent;
  border: 1px solid #ccc;
`;
