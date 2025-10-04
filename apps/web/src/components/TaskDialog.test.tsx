/** @jest-environment jsdom */
// Назначение файла: проверяет сохранение задачи и повторное открытие формы.
// Основные модули: React, @testing-library/react, TaskDialog.
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TaskDialog from "./TaskDialog";

const mockUser = { telegram_id: 99, role: "admin" } as const;

jest.mock("../context/useAuth", () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (v: string) => v }),
}));

jest.mock("./CKEditorPopup", () => () => <div />);
jest.mock("./ConfirmDialog", () => ({ open, onConfirm }: any) => {
  React.useEffect(() => {
    if (open) onConfirm();
  }, [open, onConfirm]);
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
  assigned_user_id: 1,
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
  if (url === "/api/v1/tasks/report/summary") {
    return Promise.resolve({ ok: true, json: async () => ({ count: 0 }) });
  }
  return Promise.resolve({ ok: true, json: async () => ({}) });
});

jest.mock("../utils/authFetch", () => ({
  __esModule: true,
  default: (url: string) => authFetchMock(url),
}));

const createTaskMock = jest.fn();
const updateTaskMock = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ ...taskData, _id: "1" }),
});

jest.mock("../services/tasks", () => ({
  createTask: (...args: any[]) => createTaskMock(...args),
  updateTask: (...args: any[]) => updateTaskMock(...args),
  deleteTask: jest.fn(),
  updateTaskStatus: jest.fn(),
}));

describe("TaskDialog", () => {
  beforeEach(() => {
    authFetchMock.mockClear();
    createTaskMock.mockReset();
    updateTaskMock.mockReset();
    updateTaskMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ...taskData, _id: "1" }),
    });
  });

  it("сохраняет задачу и повторно открывает форму", async () => {
    const renderDialog = () =>
      render(
        <MemoryRouter>
          <TaskDialog onClose={() => {}} id="1" />
        </MemoryRouter>,
      );
    const { unmount } = renderDialog();
    expect(await screen.findByText("taskCreatedBy")).toBeTruthy();

    fireEvent.click(screen.getByText("save"));
    await waitFor(() =>
      expect(updateTaskMock).toHaveBeenCalledWith(
        "1",
        expect.objectContaining({ assigned_user_id: 1 }),
      ),
    );

    unmount();
    renderDialog();
    expect(await screen.findByText("taskCreatedBy")).toBeTruthy();
  });

  it("не меняет дату начала при сохранении без правок", async () => {
    render(
      <MemoryRouter>
        <TaskDialog onClose={() => {}} id="1" />
      </MemoryRouter>,
    );

    const startInput = (await screen.findByLabelText("startDate")) as HTMLInputElement;
    const initialStart = startInput.value;

    fireEvent.click(screen.getByText("save"));

    await waitFor(() => expect(updateTaskMock).toHaveBeenCalled());
    expect(updateTaskMock.mock.calls[0][1]).not.toHaveProperty("start_date");
    expect(updateTaskMock.mock.calls[0][1]).not.toHaveProperty("due_date");
  });

  it("устанавливает срок на 5 часов позже даты начала по умолчанию", async () => {
    try {
      jest.useFakeTimers().setSystemTime(new Date("2024-03-01T10:00:00Z"));

      render(
        <MemoryRouter>
          <TaskDialog onClose={() => {}} />
        </MemoryRouter>,
      );

      const startInput = (await screen.findByLabelText("startDate")) as HTMLInputElement;
      const dueInput = screen.getByLabelText("dueDate") as HTMLInputElement;

      expect(startInput.value).not.toBe("");
      expect(dueInput.value).not.toBe("");

      const startMs = new Date(startInput.value).getTime();
      const dueMs = new Date(dueInput.value).getTime();

      expect(dueMs - startMs).toBe(5 * 60 * 60 * 1000);
    } finally {
      jest.useRealTimers();
    }
  });

  it("передаёт выбранный срок при создании задачи", async () => {
    createTaskMock.mockResolvedValue({ _id: "new-task" });
    render(
      <MemoryRouter>
        <TaskDialog onClose={() => {}} />
      </MemoryRouter>,
    );

    const titleInput = await screen.findByPlaceholderText("title");
    fireEvent.change(titleInput, { target: { value: "Новая задача" } });

    const startInput = screen.getByLabelText("startDate") as HTMLInputElement;
    const toLocalInputValue = (date: Date) => {
      const pad = (n: number) => `${n}`.padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
        date.getMinutes(),
      )}`;
    };
    const now = Date.now();
    const startValue = toLocalInputValue(new Date(now + 5 * 60_000));
    fireEvent.change(startInput, { target: { value: startValue } });

    const dueInput = screen.getByLabelText("dueDate") as HTMLInputElement;
    const dueValueSource = toLocalInputValue(new Date(now + 65 * 60_000));
    fireEvent.change(dueInput, { target: { value: dueValueSource } });

    fireEvent.click(screen.getByText("create"));

    await waitFor(() => expect(createTaskMock).toHaveBeenCalled());
    expect(createTaskMock.mock.calls[0][0]).toMatchObject({
      due_date: dueValueSource,
    });
  });
});
