// Назначение файла: компонент панели действий с хлебными крошками, вкладками и тулбаром
// Основные модули: React, cn util
import React from 'react';

import { cn } from '@/lib/utils';

interface ActionBarProps {
  breadcrumbs?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  toolbar?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export default function ActionBar({
  breadcrumbs,
  title,
  description,
  toolbar,
  children,
  className,
}: ActionBarProps) {
  return (
    <section
      className={cn(
        'flex flex-col gap-3 rounded-3xl border border-[color:var(--color-gray-200)]',
        'bg-[color:var(--color-gray-25)] p-4 shadow-[var(--shadow-theme-sm)] sm:p-6',
        'dark:border-[color:var(--color-gray-700)] dark:bg-[color:var(--color-gray-dark)]',
        className,
      )}
    >
      {breadcrumbs ? (
        <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-gray-500)] dark:text-[color:var(--color-gray-300)]">
          {breadcrumbs}
        </div>
      ) : null}
      {title || description || toolbar ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            {title ? (
              <h1 className="text-lg font-semibold text-[color:var(--color-gray-900)] dark:text-white sm:text-xl">
                {title}
              </h1>
            ) : null}
            {description ? (
              <p className="text-sm text-[color:var(--color-gray-600)] dark:text-[color:var(--color-gray-300)]">
                {description}
              </p>
            ) : null}
          </div>
          {toolbar ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {toolbar}
            </div>
          ) : null}
        </div>
      ) : null}
      {children ? (
        <div className="space-y-3 sm:space-y-4">{children}</div>
      ) : null}
    </section>
  );
}
