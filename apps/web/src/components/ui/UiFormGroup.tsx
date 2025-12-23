/**
 * Назначение файла: группировка поля формы на базе DaisyUI.
 * Основные модули: React, cn.
 */
import * as React from 'react';

import { cn } from '@/lib/utils';

export type UiFormGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  label?: React.ReactNode;
  help?: React.ReactNode;
  error?: React.ReactNode;
  htmlFor?: string;
};

const UiFormGroup = React.forwardRef<HTMLDivElement, UiFormGroupProps>(
  ({ className, label, help, error, htmlFor, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('form-control w-full', className)} {...props}>
        {label ? (
          <label className="label" htmlFor={htmlFor}>
            <span className="label-text">{label}</span>
          </label>
        ) : null}
        {children}
        {help ? (
          <p className="mt-1 text-xs text-base-content/70">{help}</p>
        ) : null}
        {error ? (
          <p className="mt-1 text-xs text-error">{error}</p>
        ) : null}
      </div>
    );
  },
);

UiFormGroup.displayName = 'UiFormGroup';

export { UiFormGroup };
