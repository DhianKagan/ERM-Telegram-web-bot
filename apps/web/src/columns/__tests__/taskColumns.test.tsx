/** @jest-environment jsdom */
// Назначение: проверяет колонку исполнителей таблицы задач.
// Основные модули: React, Testing Library, taskColumns.
import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import taskColumns, { TaskRow } from '../taskColumns';

describe('taskColumns', () => {
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('формирует тултип и переносы для нескольких исполнителей', () => {
    const users = {
      1: { name: 'Александр Александров' },
      2: { telegram_username: 'ivanov' },
    } as Record<number, any>;

    const row = {
      assignees: [1, 2],
    } as TaskRow;

    const columns = taskColumns(users);
    const assigneesColumn = columns.find(
      (col): col is typeof col & { accessorKey: string } =>
        typeof (col as { accessorKey?: unknown }).accessorKey === 'string' &&
        (col as { accessorKey?: string }).accessorKey === 'assignees',
    );
    expect(assigneesColumn).toBeDefined();

    const cellRenderer = assigneesColumn?.cell as
      | ((context: any) => React.ReactNode)
      | undefined;
    expect(cellRenderer).toBeDefined();
    const cell = cellRenderer?.({
      row: { original: row },
    } as any);

    const tooltip = 'Александр Александров, ivanov';
    render(<MemoryRouter>{cell as React.ReactElement}</MemoryRouter>);

    const wrapper = screen.getByTitle(tooltip);
    expect(wrapper).toHaveClass('flex-wrap');

    const badges = screen.getAllByRole('button');
    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveClass('ring-violet-500/35');
    expect(within(badges[0]).getByText(/Александр/)).toHaveClass('truncate');
    expect(badges[0].textContent).toMatch(/…$/);
    expect(badges[1].textContent).toBe('ivanov');
  });

  it('показывает обратный отсчёт до срока', () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-03-01T12:00:00Z'));

    const columns = taskColumns({});
    const dueColumn = columns.find(
      (col): col is typeof col & { accessorKey: string } =>
        typeof (col as { accessorKey?: unknown }).accessorKey === 'string' &&
        (col as { accessorKey?: string }).accessorKey === 'due_date',
    );

    expect(dueColumn).toBeDefined();
    const cellRenderer = dueColumn?.cell as
      | ((context: any) => React.ReactNode)
      | undefined;
    expect(cellRenderer).toBeDefined();

    const row = {
      start_date: '2024-02-28T12:00:00Z',
      due_date: '2024-03-05T17:30:00Z',
    } as unknown as TaskRow;

    const cell = cellRenderer?.({
      getValue: () => row.due_date,
      row: { original: row },
    } as any);

    render(<MemoryRouter>{cell as React.ReactElement}</MemoryRouter>);

    const datePart = screen.getByText('05.03.2024');
    expect(datePart.closest('time')).toHaveAttribute('dateTime', row.due_date);
    expect(
      within(datePart.closest('time') as HTMLElement).getByText('19:30'),
    ).toBeInTheDocument();
    const label = screen.getByText('До дедлайна 4 дня 5 часов 30 минут');
    const badge = label.closest('[title]');
    expect(badge).not.toBeNull();
    expect(badge as HTMLElement).toHaveClass('bg-emerald-500/25');
  });

  it('отмечает просроченный срок', () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-03-10T09:15:00Z'));

    const columns = taskColumns({});
    const dueColumn = columns.find(
      (col): col is typeof col & { accessorKey: string } =>
        typeof (col as { accessorKey?: unknown }).accessorKey === 'string' &&
        (col as { accessorKey?: string }).accessorKey === 'due_date',
    );

    expect(dueColumn).toBeDefined();
    const cellRenderer = dueColumn?.cell as
      | ((context: any) => React.ReactNode)
      | undefined;
    expect(cellRenderer).toBeDefined();

    const row = {
      start_date: '2024-02-28T12:00:00Z',
      due_date: '2024-03-05T17:30:00Z',
    } as unknown as TaskRow;

    const cell = cellRenderer?.({
      getValue: () => row.due_date,
      row: { original: row },
    } as any);

    render(<MemoryRouter>{cell as React.ReactElement}</MemoryRouter>);

    const datePart = screen.getByText('05.03.2024');
    expect(datePart.closest('time')).toHaveAttribute('dateTime', row.due_date);
    const label = screen.getByText('Просрочено на 4 дня 15 часов 45 минут');
    const badge = label.closest('[title]');
    expect(badge).not.toBeNull();
    expect(badge as HTMLElement).toHaveClass('bg-rose-500/30');
  });

  it('фиксирует отсчёт после завершения задачи и выводит примечание под названием', () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-03-07T08:00:00Z'));

    const columns = taskColumns({});
    const titleColumn = columns.find(
      (col): col is typeof col & { accessorKey: string } =>
        typeof (col as { accessorKey?: unknown }).accessorKey === 'string' &&
        (col as { accessorKey?: string }).accessorKey === 'title',
    );
    const dueColumn = columns.find(
      (col): col is typeof col & { accessorKey: string } =>
        typeof (col as { accessorKey?: unknown }).accessorKey === 'string' &&
        (col as { accessorKey?: string }).accessorKey === 'due_date',
    );

    expect(dueColumn).toBeDefined();
    expect(titleColumn).toBeDefined();
    const cellRenderer = dueColumn?.cell as
      | ((context: any) => React.ReactNode)
      | undefined;
    const titleRenderer = titleColumn?.cell as
      | ((context: any) => React.ReactNode)
      | undefined;
    expect(cellRenderer).toBeDefined();
    expect(titleRenderer).toBeDefined();

    const row = {
      start_date: '2024-03-01T09:00:00Z',
      due_date: '2024-03-10T10:00:00Z',
      completed_at: '2024-03-08T10:00:00Z',
      status: 'Выполнена',
      title: 'Задача с изображением',
    } as unknown as TaskRow;

    const dueCell = cellRenderer?.({
      getValue: () => row.due_date,
      row: { original: row },
    } as any);
    const titleCell = titleRenderer?.({
      getValue: () => row.title,
      row: { original: row },
    } as any);

    render(
      <MemoryRouter>
        <div data-testid="title-cell">{titleCell as React.ReactElement}</div>
        <div data-testid="due-cell">{dueCell as React.ReactElement}</div>
      </MemoryRouter>,
    );

    const titleContainer = screen.getByTestId('title-cell');
    expect(
      within(titleContainer).getByText('Выполнена досрочно на 2 дня'),
    ).toBeInTheDocument();

    const dueContainer = screen.getByTestId('due-cell');
    expect(
      within(dueContainer).queryByText('Выполнена досрочно на 2 дня', {
        selector: 'span:not(.sr-only)',
      }),
    ).toBeNull();
    const countdownLabel = within(dueContainer).getByText(
      'До дедлайна 2 дня 0 часов 0 минут',
    );
    expect(countdownLabel).toBeInTheDocument();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('показывает время выполнения и отметку завершения', () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-03-05T12:00:00Z'));

    const columns = taskColumns({});
    const actualColumn = columns.find(
      (col): col is typeof col & { accessorKey: string } =>
        typeof (col as { accessorKey?: unknown }).accessorKey === 'string' &&
        (col as { accessorKey?: string }).accessorKey === 'completed_at',
    );

    expect(actualColumn).toBeDefined();
    const cellRenderer = actualColumn?.cell as
      | ((context: any) => React.ReactNode)
      | undefined;
    expect(cellRenderer).toBeDefined();

    const row = {
      start_date: '2024-03-01T09:00:00Z',
      in_progress_at: '2024-03-01T09:00:00Z',
      completed_at: '2024-03-03T10:30:00Z',
      status: 'Выполнена',
    } as unknown as TaskRow;

    const cell = cellRenderer?.({
      getValue: () => row.completed_at,
      row: { original: row },
    } as any);

    render(<MemoryRouter>{cell as React.ReactElement}</MemoryRouter>);

    const timeBadge = screen.getByText('03.03.2024').closest('time');
    expect(timeBadge).toHaveAttribute('dateTime', row.completed_at);
    const durationLabel = screen.getByText(
      'Задача завершена за 2 дня 1 час 30 минут',
    );
    expect(durationLabel).toBeInTheDocument();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('отображает нулевой таймер для новой задачи', () => {
    const columns = taskColumns({});
    const actualColumn = columns.find(
      (col): col is typeof col & { accessorKey: string } =>
        typeof (col as { accessorKey?: unknown }).accessorKey === 'string' &&
        (col as { accessorKey?: string }).accessorKey === 'completed_at',
    );

    expect(actualColumn).toBeDefined();
    const cellRenderer = actualColumn?.cell as
      | ((context: any) => React.ReactNode)
      | undefined;
    expect(cellRenderer).toBeDefined();

    const row = {
      start_date: null,
      in_progress_at: null,
      completed_at: null,
      status: 'Новая',
    } as unknown as TaskRow;

    const cell = cellRenderer?.({
      getValue: () => row.completed_at,
      row: { original: row },
    } as any);

    const { container } = render(
      <MemoryRouter>{cell as React.ReactElement}</MemoryRouter>,
    );

    expect(screen.getByText('Задача ещё не начата')).toBeInTheDocument();
    expect(screen.getByText('Не начата')).toBeInTheDocument();
    const digits = Array.from(
      container.querySelectorAll('[aria-hidden="true"] .tabular-nums'),
    );
    expect(digits).toHaveLength(3);
    digits.forEach((node) => {
      expect(node).toHaveTextContent(/^00$/);
    });
  });

  it('обновляет затраченное время для задачи в работе', () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-03-01T09:00:00Z'));

    const columns = taskColumns({});
    const actualColumn = columns.find(
      (col): col is typeof col & { accessorKey: string } =>
        typeof (col as { accessorKey?: unknown }).accessorKey === 'string' &&
        (col as { accessorKey?: string }).accessorKey === 'completed_at',
    );

    expect(actualColumn).toBeDefined();
    const cellRenderer = actualColumn?.cell as
      | ((context: any) => React.ReactNode)
      | undefined;
    expect(cellRenderer).toBeDefined();

    const row = {
      start_date: '2024-03-01T08:00:00Z',
      in_progress_at: '2024-03-01T09:00:00Z',
      completed_at: null,
      status: 'В работе',
    } as unknown as TaskRow;

    const cell = cellRenderer?.({
      getValue: () => row.completed_at,
      row: { original: row },
    } as any);

    const { container } = render(
      <MemoryRouter>{cell as React.ReactElement}</MemoryRouter>,
    );

    const runningLabel = screen.getByText('Затрачено менее минуты');
    expect(runningLabel).toBeInTheDocument();
    const initialDigits = Array.from(
      container.querySelectorAll('[aria-hidden="true"] .tabular-nums'),
    );
    expect(initialDigits).toHaveLength(3);
    initialDigits.forEach((node) => {
      expect(node).toHaveTextContent(/^00$/);
    });

    act(() => {
      jest.advanceTimersByTime(60 * 60 * 1000);
    });

    const updatedLabel = screen.getByText('Затрачено 0 дней 1 час 0 минут');
    expect(updatedLabel).toBeInTheDocument();
    expect(jest.getTimerCount()).toBeGreaterThan(0);
  });
});
