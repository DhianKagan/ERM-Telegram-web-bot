/**
 * Назначение файла: радиокнопка в едином стиле.
 * Основные модули: React, cn.
 */
import * as React from 'react';

import { cn } from '@/lib/utils';

export type RadioProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
>;

const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="radio"
        className={cn(
          'h-4 w-4 border-[color:var(--border)] text-[var(--color-primary)] accent-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary-400)]',
          className,
        )}
        {...props}
      />
    );
  },
);

Radio.displayName = 'Radio';

export { Radio };
