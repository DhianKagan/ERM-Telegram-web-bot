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

  it('включает виртуализацию для больших списков', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })) as typeof window.matchMedia;

    const data = Array.from({ length: 120 }, (_, index) => ({
      html: `<span>Row ${index}</span>`,
      titleOnly: `Title ${index}`,
    }));

    render(
      <DataTable
        columns={columns}
        data={data}
        pageIndex={0}
        pageSize={data.length}
        pageCount={1}
        onPageChange={() => undefined}
        showFilters={false}
        showGlobalSearch={false}
        enableVirtualization
        virtualizationThreshold={10}
        rowHeight={40}
        maxBodyHeight={200}
      />,
    );

    const container = document.querySelector('[data-slot="table-container"]');
    expect(container?.getAttribute('style')).toContain('max-height: 200px');

    const renderedRows = document.querySelectorAll('[data-slot="table-row"]');
    expect(renderedRows.length).toBeLessThan(30);

    if (originalMatchMedia) {
      window.matchMedia = originalMatchMedia;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).matchMedia;
    }
  });
});
