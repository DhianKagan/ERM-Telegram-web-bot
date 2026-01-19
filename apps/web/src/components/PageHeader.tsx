/**
 * Назначение файла: единая шапка страницы с иконкой, описанием, фильтрами и действиями.
 * Основные модули: React, Card.
 */
import React from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type PageHeaderProps = {
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  description?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  className?: string;
};

export default function PageHeader({
  icon: Icon,
  title,
  description,
  breadcrumbs,
  actions,
  filters,
  className,
}: PageHeaderProps) {
  return (
    <Card className={cn('w-full', className)} bodyClassName="gap-4">
      {breadcrumbs ? (
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {breadcrumbs}
        </div>
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          {Icon ? (
            <div className="flex size-11 items-center justify-center rounded-2xl bg-muted/50 text-primary shadow-xs">
              <Icon className="size-5" />
            </div>
          ) : null}
          <div className="min-w-0 space-y-1">
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      {filters ? (
        <div className="rounded-lg border border-border bg-card p-4">
          {filters}
        </div>
      ) : null}
    </Card>
  );
}
