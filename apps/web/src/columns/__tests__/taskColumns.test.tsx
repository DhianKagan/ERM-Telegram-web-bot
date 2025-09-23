/** @jest-environment jsdom */
// Назначение: проверяет колонку исполнителей таблицы задач.
// Основные модули: React, Testing Library, taskColumns.
import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import taskColumns, { TaskRow } from "../taskColumns";

describe("taskColumns", () => {
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
    expect(badges[0]).toHaveClass("ring-indigo-500/35");
    expect(within(badges[0]).getByText(/Александр/)).toHaveClass("truncate");
    expect(badges[0].textContent).toMatch(/…$/);
    expect(badges[1].textContent).toBe("ivanov");
  });
});
