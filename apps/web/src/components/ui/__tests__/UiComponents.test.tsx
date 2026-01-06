/**
 * Назначение файла: базовые тесты для актуальных UI-компонентов.
 * Основные модули: React, @testing-library/react.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

import { Button } from '../button';
import { Card } from '../card';
import { FormGroup } from '../form-group';
import { Input } from '../input';
import { Radio } from '../radio';
import { Select } from '../select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../table';

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

  it('renders Table with header and body rows', () => {
    render(
      <Table data-testid="table" zebra>
        <TableHeader>
          <TableRow>
            <TableHead>Имя</TableHead>
            <TableHead align="right">Роль</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Аня</TableCell>
            <TableCell align="right">Менеджер</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByTestId('table')).toHaveClass('ui-table');
    expect(screen.getByText('Имя').closest('th')).toHaveClass('ui-table__head');
    expect(screen.getByText('Менеджер').closest('td')).toHaveClass(
      'ui-table__cell',
    );
  });
});
