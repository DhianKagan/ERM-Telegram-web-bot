/**
 * Назначение файла: базовые тесты для актуальных UI-компонентов.
 * Основные модули: React, @testing-library/react.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { Button } from '../button';
import { Card } from '../card';
import { FormGroup } from '../form-group';
import { Input } from '../input';
import { Radio } from '../radio';
import { Select } from '../select';
import { SimpleTable } from '../simple-table';

describe('UI components', () => {
  it('renders Button with variant and size classes', () => {
    render(
      <Button variant="secondary" size="lg">
        Отправить
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Отправить' });
    expect(button).toHaveAttribute('data-slot', 'button');
    expect(button.className).toContain('inline-flex');
  });

  it('renders Input with className and placeholder', () => {
    render(<Input placeholder="Email" className="custom-input" />);

    const input = screen.getByPlaceholderText('Email');
    expect(input).toHaveClass('custom-input');
    expect(input).toHaveAttribute('name');
  });

  it('renders Select with options', () => {
    render(
      <Select aria-label="Статус">
        <option value="new">Новый</option>
      </Select>,
    );

    const select = screen.getByRole('combobox', { name: 'Статус' });
    expect(select).toHaveDisplayValue('Новый');
    expect(select.className).toContain('rounded-md');
  });

  it('renders Radio with custom class', () => {
    render(<Radio data-testid="radio" className="custom-radio" />);

    const radio = screen.getByTestId('radio');
    expect(radio).toHaveClass('custom-radio');
    expect(radio).toHaveAttribute('type', 'radio');
  });

  it('renders Card with body content', () => {
    render(
      <Card bodyClassName="p-2">
        <span>Карточка</span>
      </Card>,
    );

    const body = screen.getByText('Карточка').parentElement;
    expect(body).toHaveClass('p-2');
  });

  it('renders FormGroup with label, help and error', () => {
    render(
      <FormGroup label="Название" help="Подсказка" error="Ошибка">
        <Input aria-label="Название" />
      </FormGroup>,
    );

    expect(screen.getByText('Название')).toBeInTheDocument();
    expect(screen.getByText('Подсказка')).toBeInTheDocument();
    expect(screen.getByText('Ошибка')).toBeInTheDocument();
  });

  it('renders SimpleTable with rows and handles clicks', () => {
    const onRowClick = jest.fn();
    const columns = [
      { key: 'name', header: 'Имя', headerClassName: 'header-class' },
      {
        key: 'role',
        header: 'Роль',
        className: 'cell-class',
        render: (row: { role: string }) => row.role.toUpperCase(),
      },
    ];
    const rows = [{ id: 1, name: 'Аня', role: 'менеджер' }];

    render(
      <SimpleTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={onRowClick}
      />,
    );

    expect(screen.getByText('Имя').closest('th')).toHaveClass('header-class');
    const cell = screen.getByText('МЕНЕДЖЕР');
    expect(cell.closest('td')).toHaveClass('cell-class');

    fireEvent.click(cell.closest('tr') as HTMLTableRowElement);
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it('renders SimpleTable empty state', () => {
    render(
      <SimpleTable
        columns={[{ key: 'name', header: 'Имя' }]}
        rows={[]}
        rowKey={(row) => (row as { name: string }).name}
        empty="Пусто"
      />,
    );

    expect(screen.getByText('Пусто')).toBeInTheDocument();
  });
});
