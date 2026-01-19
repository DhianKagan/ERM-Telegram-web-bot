// Назначение файла: компонент панели действий с хлебными крошками, вкладками и тулбаром
// Основные модули: React, cn util
import React from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ActionBarProps {
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  breadcrumbs?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  toolbar?: React.ReactNode;
  filters?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export default function ActionBar({
  icon: Icon,
  breadcrumbs,
  title,
  description,
  toolbar,
  filters,
  children,
  className,
}: ActionBarProps) {
  return (
    <Card className={cn('w-full', className)} bodyClassName="gap-4">
      {breadcrumbs ? (
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {breadcrumbs}
        </div>
      ) : null}
      {title || description || toolbar ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3">
            {Icon ? (
              <div className="flex size-11 items-center justify-center rounded-2xl bg-muted/50 text-primary shadow-xs">
                <Icon className="size-5" />
              </div>
            ) : null}
            <div className="min-w-0 space-y-1">
              {title ? (
                <h1 className="text-lg font-semibold text-foreground sm:text-xl">
                  {title}
                </h1>
              ) : null}
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </div>
          {toolbar ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {toolbar}
            </div>
          ) : null}
        </div>
      ) : null}
      {filters ? (
        <div className="rounded-lg border border-border bg-card p-4">
          {filters}
        </div>
      ) : null}
      {children ? (
        <div className="space-y-3 sm:space-y-4">{children}</div>
      ) : null}
    </Card>
  );
}
