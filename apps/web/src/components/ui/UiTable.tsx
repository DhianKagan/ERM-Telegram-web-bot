/**
 * Назначение файла: табличный компонент на базе DaisyUI.
 * Основные модули: React, cn.
 */
import * as React from 'react';

import { cn } from '@/lib/utils';

export type UiTableColumn<T> = {
  key: string;
  header: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
};

export type UiTableProps<T> = React.TableHTMLAttributes<HTMLTableElement> & {
  columns: UiTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  empty?: React.ReactNode;
  onRowClick?: (row: T) => void;
};

const renderCellValue = <T,>(column: UiTableColumn<T>, row: T) => {
  if (column.render) {
    return column.render(row);
  }
  const record = row as Record<string, React.ReactNode>;
  return record[column.key];
};

const UiTable = <T,>({
  columns,
  rows,
  rowKey,
  empty,
  onRowClick,
  className,
  ...props
}: UiTableProps<T>) => {
  const hasRows = rows.length > 0;
  const isClickable = typeof onRowClick === 'function';

  return (
    <table className={cn('table w-full', className)} {...props}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} className={column.headerClassName}>
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {hasRows ? (
          rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={cn({ 'cursor-pointer hover': isClickable })}
              onClick={isClickable ? () => onRowClick(row) : undefined}
            >
              {columns.map((column) => (
                <td key={column.key} className={column.className}>
                  {renderCellValue(column, row)}
                </td>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            <td
              colSpan={columns.length}
              className="text-center text-sm opacity-70"
            >
              {empty ?? 'Нет данных'}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};

export { UiTable };
