import styled from 'styled-components';

const Panel = styled.div`
  color: #FFF;
  padding: 8px;
`;

export function Card({ active }: { active: boolean }) {
  return (
    <Panel className={cn('rounded-md', active ? 'bg-red-500' : 'bg-gray-100', 'text-[#123456]')}>
      card
    </Panel>
  );
}
