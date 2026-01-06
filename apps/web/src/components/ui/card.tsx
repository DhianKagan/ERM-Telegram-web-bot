/**
 * Назначение файла: карточка содержимого на дизайн-токенах.
 * Основные модули: React, cn.
 */
import * as React from 'react';

import { cn } from '@/lib/utils';

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  bodyClassName?: string;
};

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, bodyClassName, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('ui-card', className)} {...props}>
        <div className={cn('flex flex-col gap-4', bodyClassName)}>
          {children}
        </div>
      </div>
    );
  },
);

Card.displayName = 'Card';

export { Card };
