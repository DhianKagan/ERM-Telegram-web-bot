/**
 * Назначение файла: группировка элементов формы в едином стиле.
 * Основные модули: React, cn.
 */
import * as React from 'react';

import { cn } from '@/lib/utils';

export type FormGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  label?: React.ReactNode;
  help?: React.ReactNode;
  error?: React.ReactNode;
  htmlFor?: string;
};

const FormGroup = React.forwardRef<HTMLDivElement, FormGroupProps>(
  ({ className, label, help, error, htmlFor, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('w-full space-y-2', className)} {...props}>
        {label ? (
          <label
            className="text-sm font-medium text-[color:var(--color-gray-800)] dark:text-white"
            htmlFor={htmlFor}
          >
            {label}
          </label>
        ) : null}
        {children}
        {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
        {error ? (
          <p className="text-xs text-[color:var(--color-danger)]">{error}</p>
        ) : null}
      </div>
    );
  },
);

FormGroup.displayName = 'FormGroup';

export { FormGroup };
