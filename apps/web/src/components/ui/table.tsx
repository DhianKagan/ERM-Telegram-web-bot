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
    const {
      onMouseDown: containerMouseDown,
      className: containerClassName,
      ...restContainerProps
    } = containerProps ?? {};
    const containerRef = React.useRef<HTMLDivElement>(null);
    const dragStateRef = React.useRef({
      isActive: false,
      startX: 0,
      startY: 0,
      scrollLeft: 0,
      scrollTop: 0,
    });
    const [isDragging, setIsDragging] = React.useState(false);

    React.useImperativeHandle(
      ref,
      () => containerRef.current as HTMLDivElement,
    );

    const tableStyle: React.CSSProperties = {
      ...((style as React.CSSProperties) ?? {}),
      ['--table-row-height' as string]: `${rowHeight}px`,
    };

    const stopDragging = React.useCallback(() => {
      if (!dragStateRef.current.isActive) {
        return;
      }
      dragStateRef.current.isActive = false;
      setIsDragging(false);
    }, []);

    const handleMouseMove = React.useCallback((event: MouseEvent) => {
      if (!dragStateRef.current.isActive) {
        return;
      }
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const deltaX = event.pageX - dragStateRef.current.startX;
      const deltaY = event.pageY - dragStateRef.current.startY;
      container.scrollLeft = dragStateRef.current.scrollLeft - deltaX;
      container.scrollTop = dragStateRef.current.scrollTop - deltaY;
    }, []);

    const handleMouseDown = React.useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        containerMouseDown?.(event);
        if (event.defaultPrevented || event.button !== 0) {
          return;
        }
        const container = containerRef.current;
        if (!container) {
          return;
        }
        dragStateRef.current = {
          isActive: true,
          startX: event.pageX,
          startY: event.pageY,
          scrollLeft: container.scrollLeft,
          scrollTop: container.scrollTop,
        };
        setIsDragging(true);
        event.preventDefault();
      },
      [containerMouseDown],
    );

    React.useEffect(() => {
      if (!isDragging) {
        return;
      }
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', stopDragging);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', stopDragging);
      };
    }, [handleMouseMove, isDragging, stopDragging]);

    return (
      <div
        data-slot="table-container"
        {...restContainerProps}
        ref={containerRef}
        onMouseDown={handleMouseDown}
        className={cn(
          'ui-table-container',
          isDragging && 'ui-table-container--dragging',
          containerClassName,
        )}
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
