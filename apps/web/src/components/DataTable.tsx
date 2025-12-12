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

import TableToolbar from './TableToolbar';

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
}

export const defaultBadgeClassName = [
  'inline-flex min-h-[1.65rem] max-w-full items-center justify-start gap-1',
  'rounded-full px-2.5 py-0.5 text-[0.72rem] font-semibold leading-tight text-slate-900',
  'ring-1 ring-slate-300/80 bg-slate-100/90 shadow-xs',
  'dark:text-slate-100 dark:ring-slate-600/60 dark:bg-slate-800/80',
  'truncate',
].join(' ');
export const defaultBadgeWrapperClassName =
  'flex flex-wrap items-center gap-1.5';

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
        .split(/[,\n;]/)
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

const containerClasses = [
  // Важно: отдельно скроллим по X, отдельно по Y — таблица перестаёт “ломать” сетку на узких экранах
  'relative w-full overflow-x-auto overflow-y-auto rounded-xl border border-border/70',
  'bg-background shadow-sm dark:border-border/60',
].join(' ');

const tableClasses = [
  // w-max + min-w-full → на широких экранах заполняет контейнер,
  // а на узких не “сжимает” колонки до нечитаемого состояния (включается горизонтальный скролл).
  'w-max min-w-full table-fixed caption-bottom font-ui text-[12px] leading-tight',
  'text-foreground dark:text-foreground sm:text-[13px]',
].join(' ');

const headerCellClasses = [
  // Sticky header: удобно в админке при скролле списка.
  'sticky top-0 z-10 border-b border-border/70 px-1.5 py-2 text-left align-middle font-semibold',
  'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70',
  'text-[11px] leading-snug text-foreground sm:px-2 sm:text-[13px]',
  // Ключевая часть “наведения порядка”: больше не рвём строки в заголовках.
  'whitespace-nowrap',
].join(' ');

const bodyCellClasses = [
  'relative z-[1] px-1.5 py-2 align-top text-[12px] leading-snug',
  'text-foreground sm:px-2 sm:text-sm',
  // Ключевая часть: строки становятся компактными, а “длиннота” уходит в горизонтальный скролл.
  'whitespace-nowrap',
].join(' ');

const bodyRowClasses = [
  'group relative isolate min-h-[2.5rem] cursor-pointer select-none',
  'odd:bg-sky-50/70 even:bg-emerald-50/70 odd:text-slate-900 even:text-slate-900',
  'hover:odd:bg-sky-100/80 hover:even:bg-emerald-100/80',
  'dark:odd:bg-slate-800/70 dark:even:bg-slate-700/70 dark:text-slate-100',
  'dark:hover:odd:bg-slate-700 dark:hover:even:bg-slate-600',
].join(' ');

const headerRowClasses = ['text-foreground'].join(' ');

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
  rowHeight = 52,
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

  const virtualizationActive =
    enableVirtualization && rows.length > virtualizationThreshold;

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

  return (
    <div className="w-full space-y-3 px-0 font-ui text-[13px] sm:px-1.5 sm:text-sm">
      <TableToolbar
        table={table as TableType<T>}
        showGlobalSearch={showGlobalSearch}
        showFilters={showFilters}
      >
        {toolbarChildren}
      </TableToolbar>
      <div
        ref={virtualizationContainerRef}
        className={containerClasses}
        style={{ maxHeight: virtualizationActive ? maxBodyHeight : undefined }}
        onScroll={handleScroll}
      >
        <table className={tableClasses}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className={headerRowClasses}>
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
                  const headerClassName = [headerCellClasses, meta.headerClassName]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <th
                      key={header.id}
                      style={{
                        width: computedWidth,
                        minWidth: meta.minWidth ?? '4rem',
                        maxWidth: meta.maxWidth ?? '24rem',
                      }}
                      className={headerClassName}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {paddingTop > 0 ? (
              <tr aria-hidden style={{ height: paddingTop }}>
                <td colSpan={columnCount} />
              </tr>
            ) : null}
            {visibleRows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row.original)}
                className={
                  onRowClick
                    ? bodyRowClasses
                    : bodyRowClasses.replace('cursor-pointer', 'cursor-default')
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
                  const cellClassName = [bodyCellClasses, meta.cellClassName]
                    .filter(Boolean)
                    .join(' ');
                  const cellContent = flexRender(
                    cell.column.columnDef.cell,
                    cell.getContext(),
                  );
                  const shouldWrapWithBadges =
                    wrapCellsAsBadges && meta.renderAsBadges !== false;
                  return (
                    <td
                      key={cell.id}
                      style={{
                        width: computedWidth,
                        minWidth: meta.minWidth ?? '4rem',
                        maxWidth: meta.maxWidth ?? '24rem',
                      }}
                      className={cellClassName}
                    >
                      {shouldWrapWithBadges
                        ? renderBadgeContent(
                            cellContent,
                            badgeClassName,
                            badgeWrapperClassName,
                            badgeEmptyPlaceholder,
                          )
                        : cellContent}
                    </td>
                  );
                })}
              </tr>
            ))}
            {paddingBottom > 0 ? (
              <tr aria-hidden style={{ height: paddingBottom }}>
                <td colSpan={columnCount} />
              </tr>
            ) : null}
            {!rows.length ? (
              <tr>
                <td
                  colSpan={columnCount}
                  className="px-4 py-6 text-center text-sm text-muted-foreground"
                >
                  Нет данных для отображения
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between sm:text-sm">
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(0, pageIndex - 1))}
            disabled={pageIndex === 0}
            className="rounded border border-[color:var(--color-gray-300)] px-2 py-1 font-medium text-[color:var(--color-gray-700)] transition hover:bg-[color:var(--color-gray-50)] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[color:var(--color-gray-700)] dark:text-[color:var(--color-gray-200)] dark:hover:bg-[color:var(--color-gray-800)]"
          >
            Назад
          </button>
          <span className="px-1 text-[color:var(--color-gray-600)] dark:text-[color:var(--color-gray-300)]">
            Стр. {pageIndex + 1}
            {pageCount ? ` / ${pageCount}` : ''}
          </span>
          <button
            onClick={() =>
              onPageChange(
                pageCount
                  ? Math.min(pageCount - 1, pageIndex + 1)
                  : pageIndex + 1,
              )
            }
            disabled={pageCount ? pageIndex + 1 >= pageCount : false}
            className="rounded border border-[color:var(--color-gray-300)] px-2 py-1 font-medium text-[color:var(--color-gray-700)] transition hover:bg-[color:var(--color-gray-50)] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[color:var(--color-gray-700)] dark:text-[color:var(--color-gray-200)] dark:hover:bg-[color:var(--color-gray-800)]"
          >
            Вперёд
          </button>
        </div>
        {onPageSizeChange ? (
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-8 min-w-[4rem] rounded border border-[color:var(--color-gray-300)] bg-white px-1.5 text-xs text-[color:var(--color-gray-700)] shadow-sm transition focus:border-[color:var(--color-brand-400)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-200)] dark:border-[color:var(--color-gray-700)] dark:bg-[color:var(--color-gray-dark)] dark:text-[color:var(--color-gray-100)]"
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
