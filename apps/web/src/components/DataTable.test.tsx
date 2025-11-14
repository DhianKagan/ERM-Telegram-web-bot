/** @jest-environment jsdom */
// Назначение файла: тесты для DataTable с бейджами без текстовых детей
// Основные модули: React Testing Library, DataTable
import React from 'react';
import { render, screen } from '@testing-library/react';
import type { ColumnDef } from '@tanstack/react-table';

import DataTable from './DataTable';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (value: string) => value }),
}));

type SampleRow = {
  html: string;
  titleOnly: string;
};

const columns: ColumnDef<SampleRow>[] = [
  {
    accessorKey: 'html',
    header: 'HTML',
    cell: ({ getValue }) => (
      <span dangerouslySetInnerHTML={{ __html: getValue<string>() ?? '' }} />
    ),
  },
  {
    accessorKey: 'titleOnly',
    header: 'Title',
    cell: ({ getValue }) => <span title={getValue<string>() ?? ''} />,
  },
];

describe('DataTable', () => {
  it('извлекает текст из dangerous HTML и из заголовка', () => {
    render(
      <DataTable
        columns={columns}
        data={[
          {
            html: '<strong>Новый</strong> текст',
            titleOnly: 'Подпись',
          },
        ]}
        pageIndex={0}
        pageSize={10}
        onPageChange={() => undefined}
        showFilters={false}
        showGlobalSearch={false}
        wrapCellsAsBadges
      />,
    );

    expect(screen.queryByText(/Новый/)).not.toBeNull();
    expect(screen.queryByText(/Подпись/)).not.toBeNull();
  });
});
