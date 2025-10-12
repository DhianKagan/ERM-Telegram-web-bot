/** @jest-environment jsdom */
// Назначение файла: проверка открытия TaskDialog через query-параметр задачи.
// Основные модули: React, @testing-library/react, react-router-dom.
import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const refreshMock = jest.fn();
const upsertMock = jest.fn();
const removeMock = jest.fn();

const taskDialogMock = jest.fn(
  ({
    id,
    onClose,
    onSave,
  }: {
    id?: string;
    onClose: () => void;
    onSave: (data: unknown) => void;
  }) => (
    <div data-testid="task-dialog">
      <span data-testid="task-id">{id}</span>
      <button type="button" onClick={onClose}>
        Закрыть
      </button>
      <button type="button" onClick={() => onSave({ _id: id })}>
        Сохранить
      </button>
    </div>
  ),
);

jest.mock("../context/useTasks", () => ({
  __esModule: true,
  default: () => ({
    refresh: refreshMock,
    controller: {
      upsert: upsertMock,
      remove: removeMock,
    },
  }),
}));

jest.mock("./TaskDialog", () => ({
  __esModule: true,
  default: (props: any) => taskDialogMock(props),
}));

import TaskDialogRoute from "./TaskDialogRoute";

describe("TaskDialogRoute", () => {
  beforeEach(() => {
    refreshMock.mockClear();
    taskDialogMock.mockClear();
    upsertMock.mockClear();
    removeMock.mockClear();
  });

  it("отображает TaskDialog и кнопки управления при параметре task", async () => {
    render(
      <MemoryRouter initialEntries={["/tasks?task=507f1f77bcf86cd799439011"]}>
        <TaskDialogRoute />
      </MemoryRouter>,
    );

    const dialog = await screen.findByTestId("task-dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByTestId("task-id")).toHaveTextContent(
      "507f1f77bcf86cd799439011",
    );
    expect(screen.getByRole("button", { name: "Закрыть" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Сохранить" }),
    ).toBeInTheDocument();
    expect(taskDialogMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "507f1f77bcf86cd799439011" }),
    );
  });
});
