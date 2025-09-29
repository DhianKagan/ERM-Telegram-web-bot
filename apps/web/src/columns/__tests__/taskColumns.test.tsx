/** @jest-environment jsdom */
// Назначение: проверяет колонку исполнителей таблицы задач.
// Основные модули: React, Testing Library, taskColumns.
import React from "react";
import { act, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import taskColumns, { TaskRow } from "../taskColumns";

describe("taskColumns", () => {
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("формирует тултип и переносы для нескольких исполнителей", () => {
    const users = {
      1: { name: "Александр Александров" },
      2: { telegram_username: "ivanov" },
    } as Record<number, any>;

    const row = {
      assignees: [1, 2],
    } as TaskRow;

    const columns = taskColumns(users);
    const assigneesColumn = columns.find(
      (col): col is typeof col & { accessorKey: string } =>
        typeof (col as { accessorKey?: unknown }).accessorKey === "string" &&
        (col as { accessorKey?: string }).accessorKey === "assignees",
    );
    expect(assigneesColumn).toBeDefined();

    const cellRenderer = assigneesColumn?.cell as
      | ((context: any) => React.ReactNode)
      | undefined;
    expect(cellRenderer).toBeDefined();
    const cell = cellRenderer?.({
      row: { original: row },
    } as any);

    const tooltip = "Александр Александров, ivanov";
    render(<MemoryRouter>{cell as React.ReactElement}</MemoryRouter>);

    const wrapper = screen.getByTitle(tooltip);
    expect(wrapper).toHaveClass("flex-wrap");

    const badges = screen.getAllByRole("button");
    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveClass("ring-violet-500/35");
    expect(within(badges[0]).getByText(/Александр/)).toHaveClass("truncate");
    expect(badges[0].textContent).toMatch(/…$/);
    expect(badges[1].textContent).toBe("ivanov");
  });

  it("показывает обратный отсчёт до срока", () => {
    jest.useFakeTimers().setSystemTime(new Date("2024-03-01T12:00:00Z"));

    const columns = taskColumns({});
    const dueColumn = columns.find(
      (col): col is typeof col & { accessorKey: string } =>
        typeof (col as { accessorKey?: unknown }).accessorKey === "string" &&
        (col as { accessorKey?: string }).accessorKey === "due_date",
    );

    expect(dueColumn).toBeDefined();
    const cellRenderer = dueColumn?.cell as
      | ((context: any) => React.ReactNode)
      | undefined;
    expect(cellRenderer).toBeDefined();

    const row = {
      start_date: "2024-02-28T12:00:00Z",
      due_date: "2024-03-05T15:30:00Z",
    } as unknown as TaskRow;

    const cell = cellRenderer?.({
      getValue: () => row.due_date,
      row: { original: row },
    } as any);

    render(<MemoryRouter>{cell as React.ReactElement}</MemoryRouter>);

    const datePart = screen.getByText("05.03.2024");
    expect(datePart.closest("time")).toHaveAttribute("dateTime", row.due_date);
    expect(
      within(datePart.closest("time") as HTMLElement).getByText("15:30"),
    ).toBeInTheDocument();
    const label = screen.getByText(
      "До дедлайна 4 дня 3 часа 30 минут",
    );
    const badge = label.closest("[title]");
    expect(badge).not.toBeNull();
    expect(badge as HTMLElement).toHaveClass("bg-emerald-500/25");
  });

  it("отмечает просроченный срок", () => {
    jest.useFakeTimers().setSystemTime(new Date("2024-03-10T09:15:00Z"));

    const columns = taskColumns({});
    const dueColumn = columns.find(
      (col): col is typeof col & { accessorKey: string } =>
        typeof (col as { accessorKey?: unknown }).accessorKey === "string" &&
        (col as { accessorKey?: string }).accessorKey === "due_date",
    );

    expect(dueColumn).toBeDefined();
    const cellRenderer = dueColumn?.cell as
      | ((context: any) => React.ReactNode)
      | undefined;
    expect(cellRenderer).toBeDefined();

    const row = {
      start_date: "2024-02-28T12:00:00Z",
      due_date: "2024-03-05T15:30:00Z",
    } as unknown as TaskRow;

    const cell = cellRenderer?.({
      getValue: () => row.due_date,
      row: { original: row },
    } as any);

    render(<MemoryRouter>{cell as React.ReactElement}</MemoryRouter>);

    const datePart = screen.getByText("05.03.2024");
    expect(datePart.closest("time")).toHaveAttribute("dateTime", row.due_date);
    const label = screen.getByText(
      "Просрочено на 4 дня 17 часов 45 минут",
    );
    const badge = label.closest("[title]");
    expect(badge).not.toBeNull();
    expect(badge as HTMLElement).toHaveClass("bg-rose-500/30");
  });

  it("фиксирует отсчёт после завершения задачи и показывает примечание", () => {
    jest.useFakeTimers().setSystemTime(new Date("2024-03-07T08:00:00Z"));

    const columns = taskColumns({});
    const dueColumn = columns.find(
      (col): col is typeof col & { accessorKey: string } =>
        typeof (col as { accessorKey?: unknown }).accessorKey === "string" &&
        (col as { accessorKey?: string }).accessorKey === "due_date",
    );

    expect(dueColumn).toBeDefined();
    const cellRenderer = dueColumn?.cell as
      | ((context: any) => React.ReactNode)
      | undefined;
    expect(cellRenderer).toBeDefined();

    const row = {
      start_date: "2024-03-01T09:00:00Z",
      due_date: "2024-03-10T10:00:00Z",
      completed_at: "2024-03-08T10:00:00Z",
      status: "Выполнена",
    } as unknown as TaskRow;

    const cell = cellRenderer?.({
      getValue: () => row.due_date,
      row: { original: row },
    } as any);

    render(<MemoryRouter>{cell as React.ReactElement}</MemoryRouter>);

    const note = screen.getByText("Выполнена досрочно на 2 дня", {
      selector: "span:not(.sr-only)",
    });
    expect(note).toBeInTheDocument();
    const countdownLabel = screen.getByText(
      "До дедлайна 2 дня 0 часов 0 минут",
    );
    expect(countdownLabel).toBeInTheDocument();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("показывает время выполнения и отметку завершения", () => {
    jest.useFakeTimers().setSystemTime(new Date("2024-03-05T12:00:00Z"));

    const columns = taskColumns({});
    const actualColumn = columns.find(
      (col): col is typeof col & { accessorKey: string } =>
        typeof (col as { accessorKey?: unknown }).accessorKey === "string" &&
        (col as { accessorKey?: string }).accessorKey === "completed_at",
    );

    expect(actualColumn).toBeDefined();
    const cellRenderer = actualColumn?.cell as
      | ((context: any) => React.ReactNode)
      | undefined;
    expect(cellRenderer).toBeDefined();

    const row = {
      start_date: "2024-03-01T09:00:00Z",
      completed_at: "2024-03-03T10:30:00Z",
      status: "Выполнена",
    } as unknown as TaskRow;

    const cell = cellRenderer?.({
      getValue: () => row.completed_at,
      row: { original: row },
    } as any);

    render(<MemoryRouter>{cell as React.ReactElement}</MemoryRouter>);

    const timeBadge = screen.getByText("03.03.2024").closest("time");
    expect(timeBadge).toHaveAttribute("dateTime", row.completed_at);
    const durationLabel = screen.getByText(
      "Задача завершена за 2 дня 1 час 30 минут",
    );
    expect(durationLabel).toBeInTheDocument();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("обновляет затраченное время для задачи в работе", () => {
    jest.useFakeTimers().setSystemTime(new Date("2024-03-01T09:00:00Z"));

    const columns = taskColumns({});
    const actualColumn = columns.find(
      (col): col is typeof col & { accessorKey: string } =>
        typeof (col as { accessorKey?: unknown }).accessorKey === "string" &&
        (col as { accessorKey?: string }).accessorKey === "completed_at",
    );

    expect(actualColumn).toBeDefined();
    const cellRenderer = actualColumn?.cell as
      | ((context: any) => React.ReactNode)
      | undefined;
    expect(cellRenderer).toBeDefined();

    const row = {
      start_date: "2024-03-01T08:00:00Z",
      completed_at: null,
      status: "В работе",
    } as unknown as TaskRow;

    const cell = cellRenderer?.({
      getValue: () => row.completed_at,
      row: { original: row },
    } as any);

    render(<MemoryRouter>{cell as React.ReactElement}</MemoryRouter>);

    const runningLabel = screen.getByText(
      "Затрачено 0 дней 1 час 0 минут",
    );
    expect(runningLabel).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(60 * 60 * 1000);
    });

    const updatedLabel = screen.getByText(
      "Затрачено 0 дней 2 часа 0 минут",
    );
    expect(updatedLabel).toBeInTheDocument();
    expect(jest.getTimerCount()).toBeGreaterThan(0);
  });
});
