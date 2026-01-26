// Назначение файла: колонки таблицы журнала событий
// Основные модули: React, @tanstack/react-table
import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import RowActionButtons, {
  type RowActionItem,
} from '../components/RowActionButtons';

const compactText = (value: string, maxLength: number) => {
  const trimmed = value.trim();
  if (!trimmed || maxLength < 2 || trimmed.length <= maxLength) {
    return trimmed;
  }
  const shortened = trimmed.slice(0, maxLength - 1).trimEnd();
  return `${shortened}…`;
};

const formatLocationLabel = (value: string, maxLength = 28) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const [firstLine] = trimmed.split(/\n+/);
  return compactText(firstLine.trim(), maxLength);
};

export interface EventLogRow {
  id: string;
  number: string;
  dateTime: string;
  eventType: string;
  operation: string;
  performer: string;
  asset: string;
  location: string;
  locationLink?: string;
  transferLocation?: string;
  isTransfer?: boolean;
  description: string;
}

export const buildEventLogColumns = (
  options: {
    rowActions?: (row: EventLogRow) => RowActionItem[];
  } = {},
): ColumnDef<EventLogRow>[] => [
  {
    accessorKey: 'number',
    header: 'Номер',
    meta: { minWidth: '8rem', truncate: true, renderAsBadges: false },
    cell: ({ row, getValue }) => {
      const value = (getValue<string>() || '').trim();
      const actions = options.rowActions?.(row.original) ?? [];
      return (
        <div className="flex items-center justify-between gap-2">
          <span className="ui-status-badge" data-tone="neutral" title={value}>
            {value || '—'}
          </span>
          <RowActionButtons actions={actions} />
        </div>
      );
    },
  },
  {
    accessorKey: 'dateTime',
    header: 'Дата и время',
    meta: { minWidth: '8rem', truncate: true },
  },
  {
    accessorKey: 'eventType',
    header: 'Тип',
    meta: { minWidth: '8rem', truncate: true },
  },
  {
    accessorKey: 'operation',
    header: 'Операция',
    meta: { minWidth: '8rem', truncate: true },
  },
  {
    accessorKey: 'performer',
    header: 'Исполнитель',
    meta: { minWidth: '8rem', truncate: true },
  },
  {
    accessorKey: 'asset',
    header: 'Объект',
    meta: { minWidth: '10rem', truncate: true },
  },
  {
    accessorKey: 'location',
    header: 'Место',
    meta: { minWidth: '10rem', renderAsBadges: false },
    cell: ({ row }) => {
      const { location, locationLink, transferLocation, isTransfer } =
        row.original;
      const hasLocation = Boolean(location?.trim());
      const hasTransferLocation = Boolean(transferLocation?.trim());
      const badgeClassName = 'ui-status-badge max-w-full truncate';
      const locationLabel = hasLocation
        ? formatLocationLabel(location ?? '', 28)
        : '';
      const transferLabel = hasTransferLocation
        ? formatLocationLabel(transferLocation ?? '', 28)
        : '';
      if (!hasLocation && !hasTransferLocation) {
        return (
          <span className="ui-status-badge" data-tone="neutral">
            —
          </span>
        );
      }
      return (
        <div className="flex flex-col gap-1">
          {hasLocation ? (
            locationLink ? (
              <a
                href={locationLink}
                target="_blank"
                rel="noopener"
                className={badgeClassName}
                data-badge-label={locationLabel}
                data-tone="neutral"
                title={location}
              >
                {locationLabel}
              </a>
            ) : (
              <span
                className={badgeClassName}
                data-badge-label={locationLabel}
                data-tone="neutral"
                title={location}
              >
                {locationLabel}
              </span>
            )
          ) : null}
          {isTransfer && hasTransferLocation ? (
            <span
              className={badgeClassName}
              data-badge-label={`Место перемещения: ${transferLabel}`}
              data-tone="danger"
              title={`Место перемещения: ${transferLocation}`}
            >
              Место перемещения: {transferLabel}
            </span>
          ) : null}
        </div>
      );
    },
  },
  {
    accessorKey: 'description',
    header: 'Описание',
    meta: { minWidth: '10rem', renderAsBadges: false, truncate: true },
    cell: ({ row }) => (
      <span
        className="block truncate text-sm text-[color:var(--color-gray-800)]"
        data-badge-label={row.original.description}
        title={row.original.description}
      >
        {row.original.description}
      </span>
    ),
  },
];
