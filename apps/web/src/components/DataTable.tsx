// Назначение файла: универсальная таблица на React Table с виртуализацией строк
// Основные модули: React, @tanstack/react-table, TableToolbar

import React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  Table as TableType,
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import TableToolbar from './TableToolbar';
import { cn } from '@/lib/utils';

interface DataTableProps<T> {
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
}

interface ColumnMeta {
  minWidth?: string;
  maxWidth?: string;
  width?: string;
  cellClassName?: string;
  headerClassName?: string;
  renderAsBadges?: boolean;
  align?: 'left' | 'center' | 'right';
  truncate?: boolean;
}

export const defaultBadgeClassName = 'ui-status-badge ui-status-badge--muted';
export const defaultBadgeWrapperClassName =
  'flex flex-wrap items-start gap-1.5';

const sanitizeHtml = (html: string): string =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeToText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    return sanitizeHtml(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  return '';
};

const extractBadgeItems = (value: React.ReactNode): string[] => {
  const items: string[] = [];
  const pushItem = (text: string) => {
    if (!text) return;
    if (items.includes(text)) return;
    items.push(text);
  };
  const visit = (node: React.ReactNode) => {
    if (node === null || node === undefined || node === false) return;
    if (typeof node === 'string' || typeof node === 'number') {
      const text = String(node).trim();
      if (!text) return;
      const parts = text
        .split(/[\n,;]/)
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length) {
        items.push(...parts);
      } else {
        items.push(text);
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (React.isValidElement(node)) {
      const element = node as React.ReactElement<Record<string, unknown>>;
      const beforeLength = items.length;
      visit(element.props.children as React.ReactNode);
      if (items.length === beforeLength) {
        const props = element.props || {};
        const fallbackCandidates: unknown[] = [
          props['data-badge-label'],
          props['data-label'],
          props['aria-label'],
          props.title,
        ];
        fallbackCandidates.forEach((candidate) => {
          if (candidate === null || candidate === undefined) return;
          const text = String(candidate).trim();
          pushItem(text);
        });
        const html = props.dangerouslySetInnerHTML as
          | { __html?: unknown }
          | undefined;
        const rawHtml =
          html && typeof html.__html === 'string'
            ? sanitizeHtml(html.__html)
            : '';
        if (rawHtml) {
          pushItem(rawHtml);
        }
        const renderValue = props.renderValue;
        if (typeof renderValue === 'function') {
          const rendered = normalizeToText(renderValue());
          pushItem(rendered);
        }
        const getValue = props.getValue;
        if (typeof getValue === 'function') {
          const rawValue = normalizeToText(getValue());
          pushItem(rawValue);
        }
      }
      return;
    }
    const fallback = String(node).trim();
    pushItem(fallback);
  };
  visit(value);
  return items;
};

const renderBadgeContent = (
  content: React.ReactNode,
  badgeClassName: string,
  wrapperClassName: string,
  emptyPlaceholder: string,
) => {
  const items = extractBadgeItems(content);
  if (!items.length) {
    return (
      <span className={badgeClassName} title={emptyPlaceholder}>
        {emptyPlaceholder}
      </span>
    );
  }
  if (items.length === 1) {
    return (
      <span className={badgeClassName} title={items[0]}>
        {items[0]}
      </span>
    );
  }
  return (
    <div className={wrapperClassName}>
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className={badgeClassName} title={item}>
          {item}
        </span>
      ))}
    </div>
  );
};

const bodyRowClasses = 'transition-colors';
const headerRowClasses = 'text-[13px] font-semibold';

export default function DataTable<T>({
  columns,
  data,
  pageIndex,
  pageSize,
  pageCount,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  toolbarChildren,
  showGlobalSearch = true,
  showFilters = true,
  wrapCellsAsBadges = false,
  badgeClassName = defaultBadgeClassName,
  badgeWrapperClassName = defaultBadgeWrapperClassName,
  badgeEmptyPlaceholder = '—',
  enableVirtualization = true,
  virtualizationOverscan = 6,
  virtualizationThreshold = 40,
  rowHeight = 56,
  maxBodyHeight = 520,
}: DataTableProps<T>) {
  const [columnVisibility, setColumnVisibility] = React.useState({});
  const [columnOrder, setColumnOrder] = React.useState<string[]>([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      columnVisibility,
      columnOrder,
      pagination: { pageIndex, pageSize },
    },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
  });

  const rows = table.getRowModel().rows;
  const virtualizationContainerRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewportHeight, setViewportHeight] = React.useState(maxBodyHeight);
  const [isSmUp, setIsSmUp] = React.useState(false);

  const virtualizationActive =
    enableVirtualization && isSmUp && rows.length > virtualizationThreshold;

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia('(min-width: 640px)');
    const updateIsSmUp = () => setIsSmUp(mediaQuery.matches);
    updateIsSmUp();
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateIsSmUp);
      return () => mediaQuery.removeEventListener('change', updateIsSmUp);
    }
    mediaQuery.addListener(updateIsSmUp);
    return () => mediaQuery.removeListener(updateIsSmUp);
  }, []);

  React.useLayoutEffect(() => {
    if (!virtualizationActive) return;
    const element = virtualizationContainerRef.current;
    if (!element) return;
    const updateHeight = () => {
      setViewportHeight(element.clientHeight || maxBodyHeight);
    };
    updateHeight();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateHeight);
      observer.observe(element);
      return () => observer.disconnect();
    }
    return undefined;
  }, [virtualizationActive, maxBodyHeight]);

  React.useEffect(() => {
    if (!virtualizationContainerRef.current) return;
    virtualizationContainerRef.current.scrollTop = 0;
    setScrollTop(0);
  }, [rows.length, virtualizationActive]);

  const handleScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (!virtualizationActive) return;
      setScrollTop(event.currentTarget.scrollTop);
    },
    [virtualizationActive],
  );

  const totalHeight = rows.length * rowHeight;
  const effectiveViewport = virtualizationActive
    ? viewportHeight
    : rows.length * rowHeight;
  const startIndex = virtualizationActive
    ? Math.max(0, Math.floor(scrollTop / rowHeight) - virtualizationOverscan)
    : 0;
  const endIndex = virtualizationActive
    ? Math.min(
        rows.length,
        Math.ceil((scrollTop + effectiveViewport) / rowHeight) +
          virtualizationOverscan,
      )
    : rows.length;

  const visibleRows = virtualizationActive
    ? rows.slice(startIndex, endIndex)
    : rows;
  const paddingTop = virtualizationActive ? startIndex * rowHeight : 0;
  const paddingBottom = virtualizationActive
    ? Math.max(totalHeight - endIndex * rowHeight, 0)
    : 0;

  const columnCount = Math.max(table.getVisibleLeafColumns().length, 1);

  const getSizingStyle = (meta: ColumnMeta, computedWidth?: string) => {
    const style: React.CSSProperties = {};
    if (computedWidth) style.width = computedWidth;
    if (meta.minWidth) style.minWidth = meta.minWidth;
    if (meta.maxWidth) style.maxWidth = meta.maxWidth;
    return style;
  };

  const getCellContent = (
    cell: ReturnType<
      TableType<T>['getRowModel']
    >['rows'][number]['getVisibleCells'][number],
    meta: ColumnMeta,
  ) => {
    const cellContent = flexRender(
      cell.column.columnDef.cell,
      cell.getContext(),
    );
    const shouldWrapWithBadges =
      wrapCellsAsBadges && meta.renderAsBadges !== false;
    return shouldWrapWithBadges
      ? renderBadgeContent(
          cellContent,
          badgeClassName,
          badgeWrapperClassName,
          badgeEmptyPlaceholder,
        )
      : cellContent;
  };

  return (
    <div className="w-full space-y-3 px-0 font-ui text-[13px] sm:px-1.5 sm:text-sm">
      <TableToolbar
        table={table as TableType<T>}
        showGlobalSearch={showGlobalSearch}
        showFilters={showFilters}
      >
        {toolbarChildren}
      </TableToolbar>
      <div className="space-y-2 sm:hidden">
        {!rows.length ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-center text-sm text-muted-foreground shadow-sm">
            Нет данных для отображения
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 shadow-sm"
              onClick={() => onRowClick?.(row.original)}
              role={onRowClick ? 'button' : undefined}
            >
              {row.getVisibleCells().map((cell) => {
                const meta =
                  (cell.column.columnDef.meta as ColumnMeta | undefined) || {};
                const contentTitle = meta.truncate
                  ? normalizeToText(cell.getValue()) || undefined
                  : undefined;
                return (
                  <div key={cell.id} className="flex items-start gap-3">
                    <div className="min-w-[7rem] text-[13px] font-semibold text-muted-foreground">
                      {flexRender(
                        cell.column.columnDef.header,
                        cell.getContext(),
                      )}
                    </div>
                    <div
                      className={cn(
                        'flex min-w-0 flex-1 items-center gap-2 text-sm',
                        meta.truncate && 'truncate',
                      )}
                      title={contentTitle}
                    >
                      {getCellContent(cell, meta)}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
      <Table
        zebra
        stickyHeader
        rowHeight={rowHeight}
        className="hidden table-auto sm:table"
        containerProps={{
          ref: virtualizationContainerRef,
          className: 'hidden overflow-x-auto sm:block',
          style: virtualizationActive
            ? { maxHeight: maxBodyHeight }
            : undefined,
          onScroll: handleScroll,
        }}
      >
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className={headerRowClasses}>
              {hg.headers.map((header) => {
                const meta =
                  (header.column.columnDef.meta as ColumnMeta | undefined) ||
                  {};
                const baseSize = header.getSize();
                const computedWidth =
                  typeof meta.width === 'string'
                    ? meta.width
                    : Number.isFinite(baseSize)
                      ? `${baseSize}px`
                      : undefined;
                const headerClassName = [meta.headerClassName]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <TableHead
                    key={header.id}
                    style={getSizingStyle(meta, computedWidth)}
                    align={meta.align}
                    className={headerClassName}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {paddingTop > 0 ? (
            <TableRow aria-hidden>
              <TableCell colSpan={columnCount} style={{ height: paddingTop }} />
            </TableRow>
          ) : null}
          {visibleRows.map((row) => (
            <TableRow
              key={row.id}
              onClick={() => onRowClick?.(row.original)}
              className={
                onRowClick
                  ? `${bodyRowClasses} cursor-pointer hover:bg-[var(--bg-muted)]`
                  : `${bodyRowClasses} cursor-default`
              }
            >
              {row.getVisibleCells().map((cell) => {
                const meta =
                  (cell.column.columnDef.meta as ColumnMeta | undefined) || {};
                const baseSize = cell.column.getSize();
                const computedWidth =
                  typeof meta.width === 'string'
                    ? meta.width
                    : Number.isFinite(baseSize)
                      ? `${baseSize}px`
                      : undefined;
                const cellClassName = [meta.cellClassName]
                  .filter(Boolean)
                  .join(' ');
                const cellTitle = meta.truncate
                  ? normalizeToText(cell.getValue()) || undefined
                  : undefined;
                return (
                  <TableCell
                    key={cell.id}
                    style={getSizingStyle(meta, computedWidth)}
                    align={meta.align}
                    className={cn(cellClassName, meta.truncate && 'min-w-0')}
                  >
                    <div
                      className={cn(
                        'flex min-w-0 flex-1 items-center gap-2',
                        meta.truncate && 'truncate',
                      )}
                      title={cellTitle}
                    >
                      {getCellContent(cell, meta)}
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
          {paddingBottom > 0 ? (
            <TableRow aria-hidden>
              <TableCell
                colSpan={columnCount}
                style={{ height: paddingBottom }}
              />
            </TableRow>
          ) : null}
          {!rows.length ? (
            <TableRow>
              <TableCell
                colSpan={columnCount}
                className="px-4 py-6 text-center text-sm text-muted-foreground"
              >
                Нет данных для отображения
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
      <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between sm:text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(Math.max(0, pageIndex - 1))}
            disabled={pageIndex === 0}
          >
            Назад
          </Button>
          <span className="px-1 text-[var(--color-muted)]">
            Стр. {pageIndex + 1}
            {pageCount ? ` / ${pageCount}` : ''}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              onPageChange(
                pageCount
                  ? Math.min(pageCount - 1, pageIndex + 1)
                  : pageIndex + 1,
              )
            }
            disabled={pageCount ? pageIndex + 1 >= pageCount : false}
          >
            Вперёд
          </Button>
        </div>
        {onPageSizeChange ? (
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-9 min-w-[4rem] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--color-muted)] shadow-sm transition focus:border-[var(--color-primary-400)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)]"
          >
            {[10, 25, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </div>
  );
}
