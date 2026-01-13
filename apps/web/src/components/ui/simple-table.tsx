/**
 * Назначение файла: упрощённая таблица с общими стилями и действиями.
 * Основные модули: React, DataTable, Button, Select.
 */
import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import DataTable from '@/components/DataTable';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type SimpleTableAction<T> = {
  id?: string;
  label: string;
  onClick: (row: T) => void;
  variant?: ButtonProps['variant'];
  disabled?: boolean;
  icon?: React.ReactNode;
};

type SimpleTableProps<T> = {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  pageIndex: number;
  pageSize: number;
  pageCount?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onRowClick?: (row: T) => void;
  toolbarChildren?: React.ReactNode;
  showGlobalSearch?: boolean;
  showFilters?: boolean;
  wrapCellsAsBadges?: boolean;
  badgeClassName?: string;
  badgeWrapperClassName?: string;
  badgeEmptyPlaceholder?: string;
  enableVirtualization?: boolean;
  virtualizationOverscan?: number;
  virtualizationThreshold?: number;
  rowHeight?: number;
  maxBodyHeight?: number;
  getRowActions?: (row: T) => SimpleTableAction<T>[];
  actionsLabel?: string;
};

type ColumnMeta = {
  minWidth?: string;
  cellClassName?: string;
  headerClassName?: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
};

type RowActionsProps<T> = {
  row: T;
  actions: SimpleTableAction<T>[];
  label: string;
};

const RowActions = <T,>({ row, actions, label }: RowActionsProps<T>) => {
  const [value, setValue] = React.useState('');
  const actionMap = React.useMemo(
    () =>
      actions.reduce<Record<string, SimpleTableAction<T>>>((acc, action) => {
        const key = action.id ?? action.label;
        acc[key] = action;
        return acc;
      }, {}),
    [actions],
  );
  const actionKeys = React.useMemo(() => Object.keys(actionMap), [actionMap]);

  if (actions.length === 0) {
    return null;
  }

  const handleSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    event.stopPropagation();
    const next = event.target.value;
    setValue(next);
    const action = actionMap[next];
    if (action) {
      action.onClick(row);
      setValue('');
    }
  };

  return (
    <div className="flex w-full justify-end">
      <div className="hidden flex-wrap items-center justify-end gap-2 sm:flex">
        {actions.map((action) => (
          <Button
            key={action.id ?? action.label}
            type="button"
            size="sm"
            variant={action.variant ?? 'secondary'}
            disabled={action.disabled}
            onClick={(event) => {
              event.stopPropagation();
              action.onClick(row);
            }}
            className="gap-1.5"
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </div>
      <div className="sm:hidden w-full max-w-[12rem]">
        <Select
          value={value}
          onChange={handleSelect}
          aria-label={label}
          className="h-9"
        >
          <option value="">{label}</option>
          {actionKeys.map((key) => (
            <option key={key} value={key}>
              {actionMap[key]?.label ?? key}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
};

export function SimpleTable<T>({
  columns,
  getRowActions,
  actionsLabel = 'Действия',
  rowHeight = 56,
  ...props
}: SimpleTableProps<T>) {
  const columnsWithDefaults = React.useMemo(() => {
    const defaultCellClassName = 'py-3 px-4';
    const defaultHeaderClassName = 'py-3 px-4';
    return columns.map((column) => {
      const meta = (column.meta ?? {}) as ColumnMeta;
      return {
        ...column,
        meta: {
          ...meta,
          minWidth: meta.minWidth ?? '10rem',
          cellClassName: cn(defaultCellClassName, meta.cellClassName),
          headerClassName: cn(defaultHeaderClassName, meta.headerClassName),
        },
      };
    });
  }, [columns]);

  const columnsWithActions = React.useMemo(() => {
    if (!getRowActions) {
      return columnsWithDefaults;
    }
    const actionColumn: ColumnDef<T, unknown> = {
      id: 'actions',
      header: actionsLabel,
      cell: ({ row }) => (
        <RowActions
          row={row.original}
          actions={getRowActions(row.original)}
          label={actionsLabel}
        />
      ),
      meta: {
        minWidth: '6rem',
        width: '6rem',
        align: 'right',
        cellClassName: 'py-3 px-4',
        headerClassName: 'py-3 px-4 text-right',
      },
    };
    return [...columnsWithDefaults, actionColumn];
  }, [actionsLabel, columnsWithDefaults, getRowActions]);

  return (
    <DataTable {...props} columns={columnsWithActions} rowHeight={rowHeight} />
  );
}
