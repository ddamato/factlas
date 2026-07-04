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
        card({ tone }),
        'w-72',
        'shadow-sm',
        'text-[#123456]', // arbitrary color — an anti-pattern the policy flags
        'mt-[6px]', // arbitrary spacing — also flagged
        active && 'ring-2 ring-blue-500',
        tone === 'danger' ? 'border-red-300' : 'border-gray-200',
        { 'opacity-50': !active },
      )}
    >
      <h3 className="font-medium">Payment failed</h3>
      <p className="mt-1 text-sm">Your card was declined. Update your billing details.</p>
    </div>
  );
}
