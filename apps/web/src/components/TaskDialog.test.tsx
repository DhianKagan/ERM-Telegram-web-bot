/** @jest-environment jsdom */
// Назначение файла: проверяет сохранение задачи и повторное открытие формы.
// Основные модули: React, @testing-library/react, TaskDialog.
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TaskDialog from "./TaskDialog";
import type authFetch from "../utils/authFetch";

type AuthFetchOptions = Parameters<typeof authFetch>[1];

const mockUser = { telegram_id: 99, role: "admin", access: 8 } as const;
const translate = (value: string) => value;

jest.mock("../context/useAuth", () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate }),
}));

jest.mock("./CKEditorPopup", () => () => <div />);
jest.mock("./ConfirmDialog", () => ({ open, onConfirm }: any) => {
  React.useEffect(() => {
    if (open) onConfirm();
  }, [open, onConfirm]);
  return null;
});
jest.mock("./AlertDialog", () => () => null);

jest.mock("./MultiUserSelect", () => ({
  users,
  value,
  onChange,
  onBlur,
  label,
  error,
}: any) => (
  <label>
    <span>{label}</span>
    <select
      data-testid="assignee"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
      onBlur={onBlur}
    >
      <option value="">—</option>
      {users.map((user: any) => (
        <option key={user.telegram_id} value={String(user.telegram_id)}>
          {user.name || user.telegram_username || user.username || user.telegram_id}
        </option>
      ))}
    </select>
    {error ? <div role="alert">{error}</div> : null}
  </label>
));

const users = [
  { telegram_id: 1, name: "Alice" },
  { telegram_id: 2, name: "Bob" },
];
const usersMap = users.reduce<Record<string, any>>((acc, u) => {
  acc[String(u.telegram_id)] = u;
  return acc;
}, {});

type TemplateFixture = {
  _id: string;
  name: string;
  data: Record<string, unknown>;
};

const templateFixtures: TemplateFixture[] = [
  {
    _id: "tpl-1",
    name: "Базовый шаблон",
    data: {
      title: "Заголовок из шаблона",
      task_description: "Описание из шаблона",
    },
  },
];

let templatesStore: TemplateFixture[] = [];
let lastTemplatePayload: Record<string, unknown> | null = null;

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

const defaultAuthFetch = (url: string, options?: AuthFetchOptions) => {
  if (url === "/api/v1/task-templates") {
    if (options?.method === "POST") {
      let parsed: Record<string, unknown> = {};
      const body = options.body;
      if (typeof body === "string") {
        try {
          parsed = JSON.parse(body) as Record<string, unknown>;
        } catch {
          parsed = {};
        }
      }
      lastTemplatePayload = parsed;
      const created: TemplateFixture = {
        _id: `tpl-${templatesStore.length + 1}`,
        name:
          typeof parsed.name === "string" && parsed.name.trim()
            ? (parsed.name as string)
            : "Новый шаблон",
        data:
          parsed.data && typeof parsed.data === "object"
            ? (parsed.data as Record<string, unknown>)
            : {},
      };
      templatesStore = [...templatesStore, created];
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => created,
      });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => templatesStore,
    });
  }
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
  if (url.startsWith("/api/v1/task-drafts/")) {
    return Promise.resolve({
      ok: false,
      status: 404,
      json: async () => ({}),
    });
  }
  return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
};

const authFetchMock = jest.fn(defaultAuthFetch);

jest.mock("../utils/authFetch", () => ({
  __esModule: true,
  default: (url: string, options?: AuthFetchOptions) => authFetchMock(url, options),
}));

const createTaskMock = jest.fn();
const updateTaskMock = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ ...taskData, _id: "1" }),
});

const findSubmitButton = () =>
  screen.findByRole("button", {
    name: /^(create|save)$/,
  });

const clickSubmitButton = async () => {
  const submit = await findSubmitButton();
  await act(async () => {
    fireEvent.click(submit);
    await Promise.resolve();
  });
};

jest.mock("../services/tasks", () => {
  const actual = jest.requireActual("../services/tasks");
  return {
    ...actual,
    createTask: (...args: any[]) => createTaskMock(...args),
    updateTask: (...args: any[]) => updateTaskMock(...args),
    deleteTask: jest.fn(),
    updateTaskStatus: jest.fn(),
  };
});

describe("TaskDialog", () => {
  beforeEach(() => {
    authFetchMock.mockReset();
    authFetchMock.mockImplementation(defaultAuthFetch);
    createTaskMock.mockReset();
    createTaskMock.mockResolvedValue({ ...taskData, _id: "2", id: "2" });
    updateTaskMock.mockReset();
    updateTaskMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ...taskData, _id: "1" }),
    });
    templatesStore = templateFixtures.map((tpl) => ({
      ...tpl,
      data: { ...tpl.data },
    }));
    lastTemplatePayload = null;
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

    await clickSubmitButton();
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

  it("не дублирует запрос summary при редактировании черновика", async () => {
    render(
      <MemoryRouter>
        <TaskDialog onClose={() => {}} />
      </MemoryRouter>,
    );

    const summaryCalls = () =>
      authFetchMock.mock.calls.filter(
        ([url]) => url === "/api/v1/tasks/report/summary",
      );

    await waitFor(() => expect(summaryCalls()).toHaveLength(1));

    const titleField = await screen.findByPlaceholderText("title");
    await act(async () => {
      fireEvent.change(titleField, { target: { value: "Новое название" } });
    });

    await waitFor(() => expect(summaryCalls()).toHaveLength(1));
  });

  it("обновляет ObjectId после открытия по request_id", async () => {
    const requestId = "ERM_000042";
    const objectId = "507f1f77bcf86cd799439011";
    const taskWithIds = {
      ...taskData,
      _id: objectId,
      id: objectId,
      request_id: requestId,
      task_number: requestId,
    };
    authFetchMock.mockImplementation((url: string) => {
      if (url === `/api/v1/tasks/${requestId}`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ task: taskWithIds, users: usersMap }),
        });
      }
      if (url === `/api/v1/tasks/${objectId}`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ task: taskWithIds, users: usersMap }),
        });
      }
      return defaultAuthFetch(url);
    });

    render(
      <MemoryRouter>
        <TaskDialog onClose={() => {}} id={requestId} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("taskCreatedBy")).toBeTruthy();

    fireEvent.click(screen.getByText("save"));

    await waitFor(() =>
      expect(updateTaskMock).toHaveBeenCalledWith(
        objectId,
        expect.any(Object),
      ),
    );
  });

  it("не меняет дату начала при сохранении без правок", async () => {
    render(
      <MemoryRouter>
        <TaskDialog onClose={() => {}} id="1" />
      </MemoryRouter>,
    );

    const startInput = (await screen.findByLabelText("startDate")) as HTMLInputElement;
    await waitFor(() => expect(startInput.value).not.toBe(""));
    const initialStart = startInput.value;
    const dueInput = screen.getByLabelText("dueDate") as HTMLInputElement;
    await waitFor(() => expect(dueInput.value).not.toBe(""));
    const initialDue = dueInput.value;

    fireEvent.click(screen.getByText("save"));

    await waitFor(() => expect(updateTaskMock).toHaveBeenCalled());
    expect(updateTaskMock.mock.calls[0][1]).not.toHaveProperty("start_date");
    expect(updateTaskMock.mock.calls[0][1]).not.toHaveProperty("due_date");
    expect(startInput.value).toBe(initialStart);
    expect(dueInput.value).toBe(initialDue);
  });

  it(
    "не блокирует сохранение, если дата создания отличается только секундами",
    async () => {
      const withSeconds = {
        ...taskData,
        createdAt: "2024-01-01T00:00:30Z",
        start_date: "2024-01-01T00:00:30Z",
      };
      authFetchMock.mockImplementation((url: string) => {
        if (url === "/api/v1/tasks/1") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ task: withSeconds, users: usersMap }),
          });
        }
        return defaultAuthFetch(url);
      });

      render(
        <MemoryRouter>
          <TaskDialog onClose={() => {}} id="1" />
        </MemoryRouter>,
      );

      expect(await screen.findByText("taskCreatedBy")).toBeTruthy();

      fireEvent.click(screen.getByText("save"));

      await waitFor(() => expect(updateTaskMock).toHaveBeenCalled());
    },
  );

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

    await screen.findByText("taskCreatedBy");
    const assigneeSelect = (await screen.findByTestId("assignee")) as HTMLSelectElement;
    await screen.findByText("Alice");
    await act(async () => {
      fireEvent.change(assigneeSelect, { target: { value: "1" } });
      await Promise.resolve();
    });

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

    await clickSubmitButton();

    await waitFor(() => expect(createTaskMock).toHaveBeenCalled());
    expect(createTaskMock.mock.calls[0][0]).toMatchObject({
      due_date: dueValueSource,
    });
  });

  it("отклоняет сохранение без исполнителя", async () => {
    render(
      <MemoryRouter>
        <TaskDialog onClose={() => {}} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("taskCreatedBy")).toBeTruthy();

    const titleInput = screen.getByPlaceholderText("title");
    fireEvent.change(titleInput, { target: { value: "New delivery" } });

    const assigneeSelect = await screen.findByTestId("assignee");
    await screen.findByText("Alice");
    await act(async () => {
      fireEvent.change(assigneeSelect, { target: { value: "1" } });
    });
    await act(async () => {
      fireEvent.change(assigneeSelect, { target: { value: "" } });
    });

    await clickSubmitButton();

    const errorMessage = await screen.findByText("assigneeRequiredError");
    expect(errorMessage.textContent ?? "").toContain("assigneeRequiredError");
    await waitFor(() => expect(createTaskMock).not.toHaveBeenCalled());
  });

  it("создаёт задачу с выбранным исполнителем", async () => {
    render(
      <MemoryRouter>
        <TaskDialog onClose={() => {}} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("taskCreatedBy")).toBeTruthy();

    const titleInput = screen.getByPlaceholderText("title");
    fireEvent.change(titleInput, { target: { value: "Deliver docs" } });

    const assigneeSelect = await screen.findByTestId("assignee");
    await screen.findByText("Alice");
    await act(async () => {
      fireEvent.change(assigneeSelect, { target: { value: "2" } });
    });

    await clickSubmitButton();

    await waitFor(() =>
      expect(createTaskMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Deliver docs",
          assigned_user_id: 2,
        }),
      ),
    );
  });
  it("подставляет данные выбранного шаблона", async () => {
    render(
      <MemoryRouter>
        <TaskDialog onClose={() => {}} />
      </MemoryRouter>,
    );

    const templateSelect = (await screen.findByLabelText(
      "taskTemplateSelect",
    )) as HTMLSelectElement;

    await waitFor(() => {
      expect(templateSelect.disabled).toBe(false);
    });

    fireEvent.change(templateSelect, { target: { value: "tpl-1" } });

    const titleField = await screen.findByPlaceholderText("title");

    await waitFor(() => {
      const textarea = titleField as HTMLTextAreaElement;
      expect(textarea.value).toBe("Заголовок из шаблона");
    });
  });

  it("сохраняет форму как шаблон", async () => {
    const promptSpy = jest
      .spyOn(window, "prompt")
      .mockReturnValue("Новый шаблон");

    render(
      <MemoryRouter>
        <TaskDialog onClose={() => {}} />
      </MemoryRouter>,
    );

    const titleField = (await screen.findByPlaceholderText(
      "title",
    )) as HTMLTextAreaElement;
    fireEvent.change(titleField, { target: { value: "Из формы" } });

    const saveButton = await screen.findByRole("button", {
      name: "taskTemplateSaveAction",
    });

    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      const call = authFetchMock.mock.calls.find(
        ([url, opts]) =>
          url === "/api/v1/task-templates" &&
          (opts as AuthFetchOptions | undefined)?.method === "POST",
      );
      expect(call).toBeTruthy();
    });

    expect(lastTemplatePayload).toMatchObject({
      name: "Новый шаблон",
      data: expect.objectContaining({ title: "Из формы" }),
    });

    promptSpy.mockRestore();
  });
});
