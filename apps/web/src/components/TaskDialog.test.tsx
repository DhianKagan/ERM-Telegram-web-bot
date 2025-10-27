/** @jest-environment jsdom */
// Назначение файла: проверяет сохранение задачи и повторное открытие формы.
// Основные модули: React, @testing-library/react, TaskDialog.
import "@testing-library/jest-dom";
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

jest.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
jest.mock(
  "maplibre-gl-draw/dist/mapbox-gl-draw.css",
  () => ({}),
  { virtual: true },
);

jest.mock("maplibre-gl", () => {
  const instances: any[] = [];
  class MapMock {
    options: Record<string, unknown>;
    handlers: Record<string, (event?: unknown) => void>;
    constructor(options: Record<string, unknown>) {
      this.options = options;
      this.handlers = {};
      instances.push(this);
    }
    on(event: string, handler: (event?: unknown) => void) {
      this.handlers[event] = handler;
      return this;
    }
    off(event?: string) {
      if (event) {
        delete this.handlers[event];
      }
      return this;
    }
    once(event: string, handler: (event?: unknown) => void) {
      this.handlers[event] = handler;
      handler();
      return this;
    }
    addControl() {
      return this;
    }
    remove() {
      return this;
    }
    easeTo() {
      return this;
    }
    resize() {
      return this;
    }
    isStyleLoaded() {
      return true;
    }
    fire(event: string, payload?: unknown) {
      const handler = this.handlers[event];
      if (handler) {
        handler(payload);
      }
    }
  }
  class NavigationControlMock {
    constructor() {}
  }
  class MarkerMock {
    constructor(_: Record<string, unknown> = {}) {}
    setLngLat() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {
      return this;
    }
  }
  return {
    Map: MapMock,
    NavigationControl: NavigationControlMock,
    Marker: MarkerMock,
    __instances: instances,
  } as any;
});

jest.mock("maplibre-gl-draw", () => {
  return jest.fn().mockImplementation(() => ({
    __collection: { type: "FeatureCollection", features: [] },
    getAll() {
      return this.__collection;
    },
    set(collection: unknown) {
      this.__collection = JSON.parse(JSON.stringify(collection));
      return this.__collection;
    },
    deleteAll() {
      this.__collection = { type: "FeatureCollection", features: [] };
    },
    changeMode: jest.fn(),
  }));
});

jest.mock("../utils/logisticsGeozonesEvents", () => {
  const dispatchLogisticsGeozonesApply = jest.fn();
  const dispatchLogisticsGeozonesChange = jest.fn();
  const dispatchLogisticsGeozonesRequest = jest.fn();
  return {
    LOGISTICS_GEOZONES_EVENT: "logistics:geozones",
    dispatchLogisticsGeozonesApply,
    dispatchLogisticsGeozonesChange,
    dispatchLogisticsGeozonesRequest,
  };
});

const logisticsEvents = require("../utils/logisticsGeozonesEvents") as {
  dispatchLogisticsGeozonesApply: jest.Mock;
  dispatchLogisticsGeozonesChange: jest.Mock;
  dispatchLogisticsGeozonesRequest: jest.Mock;
};

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
  if (url.startsWith("/api/v1/task-templates/")) {
    const match = url.match(/^\/api\/v1\/task-templates\/(.+)$/);
    const templateId = match ? decodeURIComponent(match[1]) : "";
    if (options?.method === "DELETE") {
      const initialLength = templatesStore.length;
      templatesStore = templatesStore.filter((tpl) => tpl._id !== templateId);
      if (templatesStore.length === initialLength) {
        return Promise.resolve({
          ok: false,
          status: 404,
          text: async () => "Not Found",
        });
      }
      return Promise.resolve({
        ok: true,
        status: 204,
        text: async () => "",
      });
    }
    const found = templatesStore.find((tpl) => tpl._id === templateId) ?? null;
    return Promise.resolve({
      ok: true,
      status: found ? 200 : 404,
      json: async () => found,
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

let confirmSpy: jest.SpyInstance<boolean, [string?]>;

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
    confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
    const mapModule = require("maplibre-gl");
    if (Array.isArray(mapModule.__instances)) {
      mapModule.__instances.length = 0;
    }
    const drawMock = require("maplibre-gl-draw");
    if (typeof drawMock.mockClear === "function") {
      drawMock.mockClear();
    }
    logisticsEvents.dispatchLogisticsGeozonesApply.mockClear();
    logisticsEvents.dispatchLogisticsGeozonesChange.mockClear();
    logisticsEvents.dispatchLogisticsGeozonesRequest.mockClear();
  });

  afterEach(() => {
    confirmSpy.mockRestore();
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

  it("сохраняет пользовательские поля custom вместе с геозонами", async () => {
    const existingCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [31.1, 49.9],
                [31.2, 49.9],
                [31.2, 50.0],
                [31.1, 50.0],
                [31.1, 49.9],
              ],
            ],
          },
          properties: { name: "Loaded" },
        },
      ],
    };
    authFetchMock.mockImplementation((url: string, options?: AuthFetchOptions) => {
      if (url === "/api/v1/tasks/1") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            task: {
              ...taskData,
              custom: {
                foo: "bar",
                logisticsGeozones: existingCollection,
              },
            },
            users: usersMap,
          }),
        });
      }
      return defaultAuthFetch(url, options);
    });

    render(
      <MemoryRouter>
        <TaskDialog onClose={() => {}} id="1" />
      </MemoryRouter>,
    );

    expect(await screen.findByText("taskCreatedBy")).toBeTruthy();

    await clickSubmitButton();

    await waitFor(() => expect(updateTaskMock).toHaveBeenCalled());

    const [, payload] = updateTaskMock.mock.calls[0];
    expect(payload.custom).toBeDefined();
    expect(payload.custom.foo).toBe("bar");
    expect(payload.custom.logisticsGeozones).toEqual({
      type: "FeatureCollection",
      features: [
        expect.objectContaining({
          geometry: expect.objectContaining({ type: "Polygon" }),
        }),
      ],
    });
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

  it("удаляет выбранный шаблон задачи", async () => {
    render(
      <MemoryRouter>
        <TaskDialog onClose={() => {}} />
      </MemoryRouter>,
    );

    const templateSelect = await screen.findByLabelText("taskTemplateSelect");
    await waitFor(() => expect(templateSelect).not.toBeDisabled());
    await act(async () => {
      fireEvent.change(templateSelect, { target: { value: "tpl-1" } });
      await Promise.resolve();
    });

    const deleteButton = await screen.findByRole("button", {
      name: "taskTemplateDeleteAction",
    });

    await act(async () => {
      fireEvent.click(deleteButton);
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(
        authFetchMock.mock.calls.some(
          ([url, options]) =>
            url === "/api/v1/task-templates/tpl-1" &&
            options?.method === "DELETE",
        ),
      ).toBe(true),
    );

    expect(confirmSpy).toHaveBeenCalledWith("taskTemplateDeleteConfirm");
    expect(templateSelect).toHaveValue("");
    expect(templatesStore.find((tpl) => tpl._id === "tpl-1")).toBeUndefined();
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

  it("сохраняет координаты при выборе точек на карте", async () => {
    createTaskMock.mockResolvedValue({ _id: "map-task" });
    render(
      <MemoryRouter>
        <TaskDialog onClose={() => {}} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("taskCreatedBy")).toBeTruthy();

    const titleInput = screen.getByPlaceholderText("title");
    fireEvent.change(titleInput, { target: { value: "Маршрут" } });

    const assigneeSelect = (await screen.findByTestId("assignee")) as HTMLSelectElement;
    await screen.findByText("Alice");
    await act(async () => {
      fireEvent.change(assigneeSelect, { target: { value: "1" } });
      await Promise.resolve();
    });

    const logisticsToggle = screen.getByLabelText("logisticsToggle") as HTMLInputElement;
    fireEvent.click(logisticsToggle);

    const startMapButtons = await screen.findAllByRole("button", {
      name: "selectOnMap",
    });

    await act(async () => {
      fireEvent.click(startMapButtons[0]);
      await Promise.resolve();
    });

    expect(await screen.findByText("selectStartPoint")).toBeTruthy();

    const mapModule = require("maplibre-gl");
    const mapList: any[] = mapModule.__instances || [];
    const startMap = mapList[mapList.length - 1];
    act(() => {
      startMap.fire("click", { lngLat: { lat: 50.45, lng: 30.523 } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "accept" }));
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(screen.queryByText("selectStartPoint")).not.toBeInTheDocument(),
    );

    const finishButtons = screen.getAllByRole("button", { name: "selectOnMap" });

    await act(async () => {
      fireEvent.click(finishButtons[1]);
      await Promise.resolve();
    });

    expect(await screen.findByText("selectFinishPoint")).toBeTruthy();

    const finishMap = mapList[mapList.length - 1];
    act(() => {
      finishMap.fire("click", { lngLat: { lat: 49.8397, lng: 24.0297 } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "accept" }));
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(screen.queryByText("selectFinishPoint")).not.toBeInTheDocument(),
    );

    await clickSubmitButton();

    await waitFor(() => expect(createTaskMock).toHaveBeenCalled());

    const payload = createTaskMock.mock.calls[0][0];
    expect(payload.startCoordinates).toEqual({ lat: 50.45, lng: 30.523 });
    expect(payload.finishCoordinates).toEqual({ lat: 49.8397, lng: 24.0297 });
    expect(typeof payload.start_location_link).toBe("string");
    expect(payload.start_location_link).not.toBe("");
    expect(typeof payload.end_location_link).toBe("string");
    expect(payload.end_location_link).not.toBe("");
    expect(payload.google_route_url).toContain("google.com/maps/dir");
    expect(payload.custom).toMatchObject({
      logisticsGeozones: { type: "FeatureCollection", features: [] },
    });
  });

  it("не дублирует событие apply при неизменных геозонах", async () => {
    render(
      <MemoryRouter>
        <TaskDialog onClose={() => {}} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("taskCreatedBy")).toBeTruthy();

    const logisticsToggle = screen.getByLabelText("logisticsToggle");
    fireEvent.click(logisticsToggle);

    const mapButtons = await screen.findAllByRole("button", {
      name: "selectOnMap",
    });

    await act(async () => {
      fireEvent.click(mapButtons[0]);
      await Promise.resolve();
    });

    const mapModule = require("maplibre-gl");
    const drawModule = require("maplibre-gl-draw");
    const mapList: any[] = mapModule.__instances || [];
    const mapInstance = mapList[mapList.length - 1];
    const drawInstance =
      drawModule.mock && drawModule.mock.results.length
        ? drawModule.mock.results[drawModule.mock.results.length - 1].value
        : null;

    expect(drawInstance).toBeTruthy();
    const polygon = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [30.5, 50.5],
            [30.6, 50.5],
            [30.6, 50.6],
            [30.5, 50.6],
            [30.5, 50.5],
          ],
        ],
      },
      properties: { name: "Test" },
    };

    drawInstance.__collection = {
      type: "FeatureCollection",
      features: [polygon],
    };

    act(() => {
      mapInstance.fire("draw.create");
    });

    expect(
      logisticsEvents.dispatchLogisticsGeozonesApply,
    ).toHaveBeenCalledTimes(1);

    act(() => {
      mapInstance.fire("draw.update");
    });

    expect(
      logisticsEvents.dispatchLogisticsGeozonesApply,
    ).toHaveBeenCalledTimes(1);
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
