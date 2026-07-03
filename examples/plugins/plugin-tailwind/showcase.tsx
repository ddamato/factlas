// @factlas/plugin-tailwind — css.class facts from className usage.
import { cva } from 'class-variance-authority';
import { cn } from './cn';

export function Showcase({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        'rounded-lg p-4', //                literal tokens (utility: rounded, p)
        'text-[#123456]', //                arbitrary → is_arbitrary, value color #123456
        'w-[13px]', //                      arbitrary → length 13px
        active && 'ring-2 ring-blue-500', //static-union (conditional)
        active ? 'bg-white' : 'bg-black', //static-union
        { 'opacity-50': !active }, //       clsx object: class-like key → static-union
      )}
    >
      {/* A plain string className also works: */}
      <span className="hover:md:text-lg -mt-2" />
    </div>
  );
}

// cva variant definition — every class string collected as static-union.
export const button = cva('inline-flex rounded', {
  variants: {
    intent: { primary: 'bg-blue-600 text-white', danger: 'bg-red-600 text-white' },
    size: { sm: 'text-sm', lg: 'text-lg' },
  },
});
