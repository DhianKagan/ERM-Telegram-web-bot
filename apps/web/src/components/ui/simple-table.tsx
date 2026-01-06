/**
 * Назначение файла: простая таблица на базе Table-компонентов.
 * Основные модули: React, ui/table, cn.
 */
import * as React from 'react';

import { cn } from '@/lib/utils';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type TableProps,
} from './table';

type Alignment = 'left' | 'center' | 'right';

export type SimpleTableColumn<T> = {
  key: string;
  header: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  align?: Alignment;
};

export type SimpleTableProps<T> = Omit<TableProps, 'children'> & {
  columns: SimpleTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  empty?: React.ReactNode;
  onRowClick?: (row: T) => void;
};

const renderCellValue = <T,>(column: SimpleTableColumn<T>, row: T) => {
  if (column.render) {
    return column.render(row);
  }
  const record = row as Record<string, React.ReactNode>;
  return record[column.key];
};

const SimpleTable = <T,>({
  columns,
  rows,
  rowKey,
  empty,
  onRowClick,
  className,
  zebra = true,
  ...props
}: SimpleTableProps<T>) => {
  const hasRows = rows.length > 0;
  const isClickable = typeof onRowClick === 'function';

  return (
    <Table zebra={zebra} className={className} {...props}>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.key}
              align={column.align}
              className={column.headerClassName}
            >
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {hasRows ? (
          rows.map((row) => (
            <TableRow
              key={rowKey(row)}
              className={cn(
                isClickable && 'cursor-pointer hover:bg-[var(--bg-muted)]',
              )}
              onClick={isClickable ? () => onRowClick(row) : undefined}
            >
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  align={column.align}
                  className={column.className}
                >
                  {renderCellValue(column, row)}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell
              colSpan={columns.length}
              className="text-center text-sm text-muted-foreground"
            >
              {empty ?? 'Нет данных'}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
};

export { SimpleTable };
