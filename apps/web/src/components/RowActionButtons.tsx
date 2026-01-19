/**
 * Назначение файла: компактные иконки действий для строк таблиц.
 * Основные модули: React, Button.
 */
import React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type RowActionItem = {
  id?: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
};

type RowActionButtonsProps = {
  actions: RowActionItem[];
  className?: string;
};

export default function RowActionButtons({
  actions,
  className,
}: RowActionButtonsProps) {
  if (!actions.length) return null;
  return (
    <div className={cn('flex items-center gap-1', className)} data-drag-exclude>
      {actions.map((action) => (
        <Button
          key={action.id ?? action.label}
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label={action.label}
          title={action.label}
          onClick={(event) => {
            event.stopPropagation();
            action.onClick();
          }}
          disabled={action.disabled}
        >
          {action.icon}
        </Button>
      ))}
    </div>
  );
}
