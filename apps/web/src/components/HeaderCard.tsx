/**
 * Назначение файла: унифицированная шапка страницы с иконкой и действиями.
 * Основные модули: React, Card.
 */
import React from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type HeaderCardProps = {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  className?: string;
};

export default function HeaderCard({
  icon: IconComp,
  title,
  subtitle,
  actions,
  filters,
  className,
}: HeaderCardProps) {
  const hasSideContent = Boolean(filters || actions);
  return (
    <Card className={cn('w-full rounded-lg', className)} bodyClassName="gap-4">
      <div
        className={cn(
          'flex flex-col gap-4',
          hasSideContent &&
            'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-start',
        )}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
            <IconComp className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {hasSideContent ? (
          <div className="flex flex-col gap-3 lg:items-end">
            {filters ? (
              <div className="w-full rounded-lg bg-muted/40 p-4">{filters}</div>
            ) : null}
            {actions ? (
              <div className="flex w-full flex-wrap items-center justify-end gap-3">
                {actions}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
