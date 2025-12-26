// Назначение файла: колонки таблицы журнала событий
// Основные модули: React, @tanstack/react-table
import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';

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

export const eventLogColumns: ColumnDef<EventLogRow>[] = [
  {
    accessorKey: 'number',
    header: 'Номер',
    meta: { minWidth: '8rem', maxWidth: '12rem' },
  },
  {
    accessorKey: 'dateTime',
    header: 'Дата и время',
    meta: { minWidth: '10rem', maxWidth: '14rem' },
  },
  {
    accessorKey: 'eventType',
    header: 'Тип',
    meta: { minWidth: '10rem', maxWidth: '16rem' },
  },
  {
    accessorKey: 'operation',
    header: 'Операция',
    meta: { minWidth: '10rem', maxWidth: '16rem' },
  },
  {
    accessorKey: 'performer',
    header: 'Исполнитель',
    meta: { minWidth: '10rem', maxWidth: '18rem' },
  },
  {
    accessorKey: 'asset',
    header: 'Объект',
    meta: { minWidth: '12rem', maxWidth: '20rem' },
  },
  {
    accessorKey: 'location',
    header: 'Место',
    meta: { minWidth: '10rem', maxWidth: '20rem', renderAsBadges: false },
    cell: ({ row }) => {
      const { location, locationLink, transferLocation, isTransfer } =
        row.original;
      const hasLocation = Boolean(location?.trim());
      const hasTransferLocation = Boolean(transferLocation?.trim());
      const badgeClassName = 'ui-status-badge whitespace-pre-line';
      if (!hasLocation && !hasTransferLocation) {
        return (
          <span className="ui-status-badge" data-tone="muted">
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
                data-badge-label={location}
                data-tone="in_progress"
              >
                {location}
              </a>
            ) : (
              <span
                className={badgeClassName}
                data-badge-label={location}
                data-tone="muted"
              >
                {location}
              </span>
            )
          ) : null}
          {isTransfer && hasTransferLocation ? (
            <span
              className={badgeClassName}
              data-badge-label={`Место перемещения: ${transferLocation}`}
              data-tone="warning"
            >
              Место перемещения: {transferLocation}
            </span>
          ) : null}
        </div>
      );
    },
  },
  {
    accessorKey: 'description',
    header: 'Описание',
    meta: { minWidth: '16rem', maxWidth: '28rem', renderAsBadges: false },
    cell: ({ row }) => (
      <span
        className="block text-sm text-[color:var(--color-gray-800)]"
        data-badge-label={row.original.description}
      >
        {row.original.description}
      </span>
    ),
  },
];
