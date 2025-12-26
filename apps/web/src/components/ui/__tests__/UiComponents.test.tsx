/**
 * Назначение файла: базовые тесты для компонентов UI.
 * Основные модули: React, @testing-library/react.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { UiButton } from '../UiButton';
import { UiCard } from '../UiCard';
import { UiCheckbox } from '../UiCheckbox';
import { UiFormGroup } from '../UiFormGroup';
import { UiInput } from '../UiInput';
import { UiModal } from '../UiModal';
import { UiRadio } from '../UiRadio';
import { UiSelect } from '../UiSelect';
import { UiTable } from '../UiTable';

describe('Ui components', () => {
  it('renders UiButton with variant and size classes', () => {
    render(
      <UiButton variant="secondary" size="lg">
        Отправить
      </UiButton>,
    );

    const button = screen.getByRole('button', { name: 'Отправить' });
    expect(button).toHaveClass('btn', 'btn-secondary', 'btn-lg');
  });

  it('renders UiInput with className and placeholder', () => {
    render(<UiInput placeholder="Email" className="custom-input" />);

    const input = screen.getByPlaceholderText('Email');
    expect(input).toHaveClass('input', 'custom-input');
  });

  it('renders UiSelect with options', () => {
    render(
      <UiSelect aria-label="Статус">
        <option value="new">Новый</option>
      </UiSelect>,
    );

    const select = screen.getByRole('combobox', { name: 'Статус' });
    expect(select).toHaveClass('select');
  });

  it('renders UiCheckbox with DaisyUI class', () => {
    render(<UiCheckbox data-testid="checkbox" className="custom-checkbox" />);

    const checkbox = screen.getByTestId('checkbox');
    expect(checkbox).toHaveClass('checkbox', 'custom-checkbox');
  });

  it('renders UiRadio with DaisyUI class', () => {
    render(<UiRadio data-testid="radio" className="custom-radio" />);

    const radio = screen.getByTestId('radio');
    expect(radio).toHaveClass('radio', 'custom-radio');
  });

  it('renders UiCard with body content', () => {
    render(
      <UiCard>
        <span>Карточка</span>
      </UiCard>,
    );

    expect(screen.getByText('Карточка')).toBeInTheDocument();
  });

  it('renders UiFormGroup with label, help and error', () => {
    render(
      <UiFormGroup label="Название" help="Подсказка" error="Ошибка">
        <UiInput aria-label="Название" />
      </UiFormGroup>,
    );

    expect(screen.getByText('Название')).toBeInTheDocument();
    expect(screen.getByText('Подсказка')).toBeInTheDocument();
    expect(screen.getByText('Ошибка')).toBeInTheDocument();
  });

  it('renders UiTable with rows', () => {
    const columns = [
      { key: 'name', header: 'Имя' },
      { key: 'role', header: 'Роль' },
    ];
    const rows = [{ id: 1, name: 'Аня', role: 'Менеджер' }];

    render(<UiTable columns={columns} rows={rows} rowKey={(row) => row.id} />);

    expect(screen.getByText('Имя')).toBeInTheDocument();
    expect(screen.getByText('Аня')).toBeInTheDocument();
  });

  it('renders UiTable empty state', () => {
    render(
      <UiTable
        columns={[{ key: 'name', header: 'Имя' }]}
        rows={[]}
        rowKey={(row) => row.name}
        empty="Пусто"
      />,
    );

    expect(screen.getByText('Пусто')).toBeInTheDocument();
  });

  it('renders UiTable custom renderers and handles row clicks', () => {
    const onRowClick = jest.fn();
    const columns = [
      {
        key: 'name',
        header: 'Имя',
        headerClassName: 'header-class',
        className: 'cell-class',
        render: (row: { name: string }) => (
          <span>{row.name.toUpperCase()}</span>
        ),
      },
    ];
    const rows = [{ id: 1, name: 'тест' }];

    render(
      <UiTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={onRowClick}
      />,
    );

    const header = screen.getByText('Имя').closest('th');
    expect(header).toHaveClass('header-class');

    const cell = screen.getByText('ТЕСТ');
    expect(cell.closest('td')).toHaveClass('cell-class');

    const row = cell.closest('tr');
    expect(row).toHaveClass('cursor-pointer');

    fireEvent.click(row as HTMLTableRowElement);
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it('renders UiModal with content', () => {
    render(
      <UiModal open>
        <p>Содержимое</p>
      </UiModal>,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Содержимое')).toBeInTheDocument();
  });

  it('does not mark UiModal as open when flag is false', () => {
    render(
      <UiModal>
        <p>Закрыто</p>
      </UiModal>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).not.toHaveAttribute('open');
  });
});
