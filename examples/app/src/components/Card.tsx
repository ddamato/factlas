import { cva } from 'class-variance-authority';
import { cn } from '../lib/cn';

// cva variant definition — all class strings collected as static-union.
export const card = cva('rounded-lg border p-4', {
  variants: {
    tone: {
      neutral: 'bg-white text-gray-900',
      danger: 'bg-red-50 text-red-700',
    },
    size: {
      sm: 'text-sm',
      lg: 'text-lg',
    },
  },
});

export function Card({ tone, active }: { tone: 'neutral' | 'danger'; active: boolean }) {
  return (
    <div
      className={cn(
        'shadow-sm',
        'text-[#123456]',
        'w-[13px]',
        active && 'ring-2 ring-blue-500',
        tone === 'danger' ? 'border-red-300' : 'border-gray-200',
        { 'opacity-50': !active },
      )}
    >
      card
    </div>
  );
}
