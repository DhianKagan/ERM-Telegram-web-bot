/**
 * Назначение файла: селект на базе DaisyUI.
 * Основные модули: React, cn.
 */
import * as React from 'react';

import { cn } from '@/lib/utils';

export type UiSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const UiSelect = React.forwardRef<HTMLSelectElement, UiSelectProps>(
  ({ className, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn('select select-bordered w-full', className)}
        {...props}
      />
    );
  },
);

UiSelect.displayName = 'UiSelect';

export { UiSelect };
