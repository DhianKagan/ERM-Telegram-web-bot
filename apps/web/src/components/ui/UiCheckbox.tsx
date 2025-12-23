/**
 * Назначение файла: чекбокс на базе DaisyUI.
 * Основные модули: React, cn.
 */
import * as React from 'react';

import { cn } from '@/lib/utils';

export type UiCheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
>;

const UiCheckbox = React.forwardRef<HTMLInputElement, UiCheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={cn('checkbox', className)}
        {...props}
      />
    );
  },
);

UiCheckbox.displayName = 'UiCheckbox';

export { UiCheckbox };
