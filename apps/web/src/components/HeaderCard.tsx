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
  className?: string;
};

export default function HeaderCard({
  icon: IconComp,
  title,
  subtitle,
  actions,
  className,
}: HeaderCardProps) {
  return (
    <Card
      className={cn('w-full rounded-lg p-6', className)}
      bodyClassName="gap-4"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
        {actions ? (
          <div className="flex items-center gap-3">{actions}</div>
        ) : null}
      </div>
    </Card>
  );
}
