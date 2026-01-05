import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex min-w-0 items-center gap-1 whitespace-nowrap rounded-full text-center font-semibold leading-tight shadow-xs',
  {
    variants: {
      variant: {
        solid: 'uppercase tracking-wide',
        pill: 'text-left tracking-normal',
      },
      size: {
        sm: 'min-h-[var(--badge-size-sm)] px-[calc(var(--badge-size-sm)*0.4)] text-[length:calc(var(--badge-size-sm)*0.6)]',
        md: 'min-h-7 px-3 text-sm',
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
