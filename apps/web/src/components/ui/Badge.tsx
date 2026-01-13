import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex items-start gap-2 rounded-full max-w-[14rem] break-words whitespace-normal bg-slate-100 text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700',
  {
    variants: {
      variant: {
        solid: 'tracking-normal',
        pill: 'text-left tracking-normal',
      },
      size: {
        sm: 'px-3 py-1 text-xs',
        md: 'px-3 py-1.5 text-sm',
      },
    },
    defaultVariants: {
      variant: 'solid',
      size: 'md',
    },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLElement> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
  };

const Badge = React.forwardRef<HTMLElement, BadgeProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'span';

    return (
      <Comp
        ref={ref as React.Ref<HTMLElement>}
        className={cn(badgeVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);

Badge.displayName = 'Badge';

export default Badge;
