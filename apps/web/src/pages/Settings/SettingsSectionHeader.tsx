/**
 * Назначение файла: общий заголовок секций настроек с иконкой и действиями.
 * Основные модули: React, Card.
 */
import React from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type SettingsSectionHeaderProps = {
  title: string;
  description?: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  controls?: React.ReactNode;
  className?: string;
};

export default function SettingsSectionHeader({
  title,
  description,
  icon: Icon,
  controls,
  className,
}: SettingsSectionHeaderProps) {
  return (
    <Card className={cn('w-full', className)} bodyClassName="gap-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-center">
        <div className="flex items-start gap-3">
          {Icon ? (
            <div className="flex size-11 items-center justify-center rounded-2xl bg-muted/50 text-primary shadow-xs">
              <Icon className="size-5" />
            </div>
          ) : null}
          <div className="min-w-0 space-y-1">
            <h2 className="truncate text-lg font-semibold text-foreground">
              {title}
            </h2>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {controls ? (
          <div className="grid w-full gap-3 lg:justify-self-end">
            {controls}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
