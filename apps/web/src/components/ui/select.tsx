/**
 * Назначение файла: базовый компонент select в едином стиле.
 * Основные модули: React, cn.
 */
import * as React from 'react';

import { cn } from '@/lib/utils';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, id, name, children, ...props }, ref) => {
    const autoId = React.useId();
    const resolvedId = id ?? name ?? `select-${autoId}`;
    const resolvedName = name ?? id ?? `select-${autoId}`;

    return (
      <select
        id={resolvedId}
        name={resolvedName}
        ref={ref}
        className={cn(
          'border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 flex min-h-[var(--touch-target)] w-full rounded-md border px-4 py-2 text-sm shadow-xs transition-colors focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);

Select.displayName = 'Select';

export { Select };
