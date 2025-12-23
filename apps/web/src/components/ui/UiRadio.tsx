/**
 * Назначение файла: радиокнопка на базе DaisyUI.
 * Основные модули: React, cn.
 */
import * as React from 'react';

import { cn } from '@/lib/utils';

export type UiRadioProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
>;

const UiRadio = React.forwardRef<HTMLInputElement, UiRadioProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="radio"
        className={cn('radio', className)}
        {...props}
      />
    );
  },
);

UiRadio.displayName = 'UiRadio';

export { UiRadio };
