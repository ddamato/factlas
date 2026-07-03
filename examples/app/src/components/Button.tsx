import styled from 'styled-components';
import { BRAND } from '../tokens';

// A resolvable one-hop const used in an interpolation is still dynamic at the
// declaration level (styled interpolations are treated as dynamic).
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
