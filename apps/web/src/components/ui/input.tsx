/**
 * Назначение файла: стилизованный компонент ввода.
 * Основные модули: React.
 */
import * as React from 'react';

import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', id, name, ...props }, ref) => {
    const autoId = React.useId();
    const resolvedId = id ?? name ?? `input-${autoId}`;
    const resolvedName = name ?? id ?? `input-${autoId}`;

    return (
      <input
        type={type}
        ref={ref}
        id={resolvedId}
        name={resolvedName}
        className={cn(
          'border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 flex h-9 w-full rounded-md border px-4 py-2 text-sm shadow-xs transition-colors focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
