/**
 * Назначение файла: поле ввода на базе DaisyUI.
 * Основные модули: React, cn.
 */
import * as React from 'react';

import { cn } from '@/lib/utils';

export type UiInputProps = React.InputHTMLAttributes<HTMLInputElement>;

const UiInput = React.forwardRef<HTMLInputElement, UiInputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn('input input-bordered w-full', className)}
        {...props}
      />
    );
  },
);

UiInput.displayName = 'UiInput';

export { UiInput };
