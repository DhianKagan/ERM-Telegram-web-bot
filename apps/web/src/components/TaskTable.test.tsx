/** @jest-environment jsdom */
// Назначение файла: тесты фильтрации таблицы задач по глобальному поиску
// Основные модули: React, @testing-library/react, TaskTable, TasksContext
import "@testing-library/jest-dom";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import TaskTable from "./TaskTable";
import { TasksContext, type TaskFilters } from "../context/TasksContext";
import { taskStateController } from "../controllers/taskStateController";
import type { TaskRow } from "../columns/taskColumns";
import type { User } from "shared";

jest.mock("./DataTable", () => ({
  __esModule: true,
  default: ({ data }: { data: TaskRow[] }) => (
    <div data-testid="mock-table">
      {data.map((row) => (
        <div key={row._id} data-testid="mock-row">
          {row.title}
        </div>
      ))}
    </div>
  ),
}));

function renderWithTasks(
  component: React.ReactElement,
  {
    query = "",
    filters = { status: [], priority: [], from: "", to: "" },
  }: { query?: string; filters?: TaskFilters } = {},
) {
  const value = {
    version: 0,
    refresh: jest.fn(),
    query,
    setQuery: jest.fn(),
    filters,
    setFilters: jest.fn(),
    controller: taskStateController,
  };
  return render(
    <TasksContext.Provider value={value}>{component}</TasksContext.Provider>,
  );
}

const baseUsers: Record<number, User> = {
  101: {
    telegram_id: 101,
    username: "ivanov",
    name: "Иван Иванов",
  },
  102: {
    telegram_id: 102,
    username: "petrov",
    name: "Пётр Петров",
  },
};

const baseTasks: TaskRow[] = [
  {
    _id: "1",
    id: "1",
    title: "Доставка документов",
    status: "Новая",
    assignees: [101],
  },
  {
    _id: "2",
    id: "2",
    title: "Сборка оборудования",
    status: "Новая",
    assignees: [102],
  },
];

describe("TaskTable поиск", () => {
  it("отфильтровывает задачи по фамилии исполнителя", async () => {
    renderWithTasks(
      <TaskTable
        tasks={baseTasks}
        users={baseUsers}
        page={0}
        pageCount={1}
        onPageChange={jest.fn()}
      />,
      { query: "Иванов" },
    );

    const rows = await screen.findAllByTestId("mock-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Доставка документов");
  });

  it("передаёт отфильтрованные строки в onDataChange", async () => {
    const handleDataChange = jest.fn();

    renderWithTasks(
      <TaskTable
        tasks={baseTasks}
        users={baseUsers}
        page={0}
        pageCount={1}
        onPageChange={jest.fn()}
        onDataChange={handleDataChange}
      />,
      { query: "Петров" },
    );

    await waitFor(() => {
      expect(handleDataChange).toHaveBeenCalledTimes(1);
    });
    const [[rows]] = handleDataChange.mock.calls as [TaskRow[]][];
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Сборка оборудования");
  });
});

