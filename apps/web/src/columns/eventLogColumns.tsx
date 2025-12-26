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
      const { location, locationLink } = row.original;
      if (locationLink) {
        return (
          <a
            href={locationLink}
            target="_blank"
            rel="noopener"
            className="ui-status-badge"
            data-badge-label={location}
            data-tone="in_progress"
          >
            {location}
          </a>
        );
      }
      return (
        <span
          className="ui-status-badge"
          data-badge-label={location}
          data-tone="muted"
        >
          {location}
        </span>
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
