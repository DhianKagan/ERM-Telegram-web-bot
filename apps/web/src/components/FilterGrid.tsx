/**
 * Назначение файла: единый контейнер фильтров с обработкой Enter/Escape.
 * Основные модули: React, Button.
 */
import React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type FilterGridProps = {
  children: React.ReactNode;
  onSearch?: () => void;
  onReset?: () => void;
  actions?: React.ReactNode;
  showDefaultActions?: boolean;
  variant?: 'card' | 'plain';
  className?: string;
};

export default function FilterGrid({
  children,
  onSearch,
  onReset,
  actions,
  showDefaultActions = true,
  variant = 'card',
  className,
}: FilterGridProps) {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onReset?.();
    }
  };

  const actionsContent = showDefaultActions ? (
    <>
      <Button type="submit" size="sm" variant="primary">
        Искать
      </Button>
      <Button type="button" size="sm" variant="primary" onClick={onReset}>
        Сбросить
      </Button>
      {actions}
    </>
  ) : (
    actions
  );

  return (
    <div
      className={cn(
        variant === 'card' ? 'rounded-lg bg-card p-5 shadow-sm' : 'w-full',
        className,
      )}
    >
      <form
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {children}
        {actionsContent ? (
          <div className="flex flex-wrap items-center justify-end gap-3 sm:col-span-2 lg:col-span-1">
            {actionsContent}
          </div>
        ) : null}
      </form>
    </div>
  );
}
