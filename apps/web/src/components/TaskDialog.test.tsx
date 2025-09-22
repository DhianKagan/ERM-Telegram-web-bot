/** @jest-environment jsdom */
// Назначение файла: проверяет сохранение задачи и повторное открытие формы.
// Основные модули: React, @testing-library/react, TaskDialog.
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TaskDialog from "./TaskDialog";

jest.mock("../context/useAuth", () => ({
  useAuth: () => ({ user: { telegram_id: 99, role: "admin" } }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (v: string) => v }),
}));

jest.mock("./CKEditorPopup", () => () => <div />);
jest.mock("./ConfirmDialog", () => ({ open, onConfirm }: any) => {
  if (open) onConfirm();
  return null;
});
jest.mock("./AlertDialog", () => () => null);

const users = [
  { telegram_id: 1, name: "Alice" },
  { telegram_id: 2, name: "Bob" },
];
const usersMap = users.reduce<Record<string, any>>((acc, u) => {
  acc[String(u.telegram_id)] = u;
  return acc;
}, {});

const taskData = {
  title: "Task",
  task_description: "",
  assignees: [1],
  start_date: "2024-01-01T00:00:00Z",
  due_date: "2024-01-02T00:00:00Z",
  created_by: 99,
  createdAt: "2024-01-01T00:00:00Z",
  department: "",
  attachments: [],
  history: [],
};

const authFetchMock = jest.fn((url: string) => {
  if (url === "/api/v1/collections/departments") {
    return Promise.resolve({ ok: true, json: async () => [] });
  }
  if (url === "/api/v1/users") {
    return Promise.resolve({ ok: true, json: async () => users });
  }
  if (url === "/api/v1/tasks/1") {
    return Promise.resolve({
      ok: true,
      json: async () => ({ task: taskData, users: usersMap }),
    });
  }
  return Promise.resolve({ ok: true, json: async () => ({}) });
});

jest.mock("../utils/authFetch", () => ({
  __esModule: true,
  default: (url: string) => authFetchMock(url),
}));

const updateTaskMock = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ ...taskData, _id: "1" }),
});

jest.mock("../services/tasks", () => ({
  createTask: jest.fn(),
  updateTask: (...args: any[]) => updateTaskMock(...args),
  deleteTask: jest.fn(),
  updateTaskStatus: jest.fn(),
}));

describe("TaskDialog", () => {
  it("сохраняет задачу и повторно открывает форму", async () => {
    const renderDialog = () =>
      render(
        <MemoryRouter>
          <TaskDialog onClose={() => {}} id="1" />
        </MemoryRouter>,
      );
    const { unmount } = renderDialog();
    expect(await screen.findByText("taskFrom")).toBeTruthy();

    fireEvent.click(screen.getByText("save"));
    await waitFor(() =>
      expect(updateTaskMock).toHaveBeenCalledWith(
        "1",
        expect.objectContaining({ assignees: ["1"] }),
      ),
    );

    unmount();
    renderDialog();
    expect(await screen.findByText("taskFrom")).toBeTruthy();
  });
});
