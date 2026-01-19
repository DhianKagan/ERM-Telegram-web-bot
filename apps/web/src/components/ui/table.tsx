'use client';

// Назначение файла: базовый компонент таблицы на дизайн-токенах.
// Модули: React, util cn
import * as React from 'react';

import { cn } from '@/lib/utils';

type Alignment = 'left' | 'center' | 'right';

export type TableProps = React.ComponentProps<'table'> & {
  zebra?: boolean;
  rowHeight?: number;
  stickyHeader?: boolean;
  containerProps?: React.HTMLAttributes<HTMLDivElement>;
};

const Table = React.forwardRef<HTMLDivElement, TableProps>(
  (
    {
      className,
      children,
      zebra = false,
      rowHeight = 56,
      stickyHeader = true,
      containerProps,
      style,
      ...props
    },
    ref,
  ) => {
    const tableStyle: React.CSSProperties = {
      ...((style as React.CSSProperties) ?? {}),
      ['--table-row-height' as string]: `${rowHeight}px`,
    };

    return (
      <div
        data-slot="table-container"
        {...containerProps}
        ref={ref}
        className={cn('ui-table-container', containerProps?.className)}
      >
        <table
          data-slot="table"
          style={tableStyle}
          className={cn(
            'ui-table',
            zebra && 'ui-table--zebra',
            stickyHeader && 'ui-table--sticky',
            className,
          )}
          {...props}
        >
          {children}
        </table>
      </div>
    );
  },
);
Table.displayName = 'Table';

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead data-slot="table-header" className={cn(className)} {...props} />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('divide-y divide-[var(--border)]', className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('bg-[var(--bg-muted)] font-medium', className)}
      {...props}
    />
  );
}

type TableRowProps = React.ComponentProps<'tr'>;

function TableRow({ className, ...props }: TableRowProps) {
  return (
    <tr
      data-slot="table-row"
      className={cn('transition-colors', className)}
      {...props}
    />
  );
}

type TableHeadProps = React.ComponentProps<'th'> & { align?: Alignment };

function TableHead({ className, align = 'left', ...props }: TableHeadProps) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'ui-table__head',
        align === 'center' && 'ui-table__cell--center',
        align === 'right' && 'ui-table__cell--right',
        className,
      )}
      {...props}
    />
  );
}

type TableCellProps = React.ComponentProps<'td'> & { align?: Alignment };

function TableCell({ className, align = 'left', ...props }: TableCellProps) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'ui-table__cell',
        align === 'center' && 'ui-table__cell--center',
        align === 'right' && 'ui-table__cell--right',
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('mt-4 text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
