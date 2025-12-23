/**
 * Назначение файла: карточка на базе DaisyUI.
 * Основные модули: React, cn.
 */
import * as React from 'react';

import { cn } from '@/lib/utils';

export type UiCardProps = React.HTMLAttributes<HTMLDivElement> & {
  bodyClassName?: string;
};

const UiCard = React.forwardRef<HTMLDivElement, UiCardProps>(
  ({ className, bodyClassName, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('card bg-base-100 shadow', className)}
        {...props}
      >
        <div className={cn('card-body', bodyClassName)}>{children}</div>
      </div>
    );
  },
);

UiCard.displayName = 'UiCard';

export { UiCard };
