/** @jest-environment jsdom */
// Назначение: тесты страницы логистики с отображением техники и треков
// Основные модули: React, @testing-library/react, Leaflet-моки

import "@testing-library/jest-dom";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import LogisticsPage from "./Logistics";
import { taskStateController } from "../controllers/taskStateController";
import type { RoutePlan } from "shared";
import type {
  OptimizeRoutePayload,
  RouteOptimizationResult,
} from "../services/optimizer";
jest.mock("react-i18next", () => {
  const templates: Record<string, string> = {
    appTitle: "ERM WEB",
    loading: "Загрузка...",
    reset: "Сбросить",
    refresh: "Обновить",
    "logistics.title": "Логистика",
    "logistics.transport": "Транспорт",
    "logistics.unselectedVehicle": "Не выбран",
    "logistics.refreshFleet": "Обновить автопарк",
    "logistics.selectedVehicle": "Выбран транспорт: {{name}}",
    "logistics.noVehicles": "Транспорт не найден",
    "logistics.loadError": "Не удалось загрузить транспорт автопарка",
    "logistics.adminOnly": "Автопарк доступен только администраторам",
    "logistics.noAccess": "Нет доступа к автопарку",
    "logistics.optimize": "Просчёт логистики",
    "logistics.vehicleTasksCount": "Задач: {{count}}",
    "logistics.vehicleMileage": "Пробег: {{value}} км",
    "logistics.vehicleCountLabel": "Машины",
    "logistics.vehicleCountAria": "Количество машин",
    "logistics.optimizeMethodLabel": "Метод",
    "logistics.optimizeMethodAria": "Метод оптимизации",
    "logistics.linksLabel": "Маршрут {{index}}",
    "logistics.tasksHeading": "Задачи",
    "logistics.metaTitle": "ERM WEB",
    "logistics.metaDescription": "Планирование маршрутов, управление автопарком и анализ доставок по агрегированным данным.",
    "logistics.planSectionTitle": "Маршрутный план",
    "logistics.planSummary": "Итоги плана",
    "logistics.planStatus": "Статус",
    "logistics.planStatusValue.draft": "Черновик",
    "logistics.planStatusValue.approved": "Утверждён",
    "logistics.planStatusValue.completed": "Завершён",
    "logistics.planReload": "Обновить план",
    "logistics.planClear": "Сбросить план",
    "logistics.planApprove": "Опубликовать",
    "logistics.planComplete": "Завершить",
    "logistics.planTitleLabel": "Название маршрутного плана",
    "logistics.planNotesLabel": "Примечания",
    "logistics.planTotalDistance": "Общее расстояние",
    "logistics.planTotalRoutes": "Маршрутов",
    "logistics.planTotalTasks": "Задач",
    "logistics.planTotalStops": "Остановок",
    "logistics.planTotalEta": "Время в пути",
    "logistics.planTotalLoad": "Загрузка",
    "logistics.planRouteTitle": "Маршрут {{index}}",
    "logistics.planRouteSummary": "Задач: {{tasks}}, остановок: {{stops}}",
    "logistics.planRouteDistance": "Расстояние: {{distance}}",
    "logistics.planRouteEmpty": "Нет задач",
    "logistics.planDriver": "Водитель",
    "logistics.planVehicle": "Транспорт",
    "logistics.planRouteNotes": "Заметки по маршруту",
    "logistics.planDragHint": "Подсказка",
    "logistics.planTaskDragHandle": "Перетащить",
    "logistics.planDropAllowed": "Перетащите сюда",
    "logistics.planTaskUp": "Вверх",
    "logistics.planTaskDown": "Вниз",
    "logistics.planSaved": "Сохранено",
    "logistics.planSaveError": "Ошибка сохранения",
    "logistics.planPublished": "Опубликовано",
    "logistics.planCompleted": "Завершено",
    "logistics.planStatusError": "Ошибка статуса",
    "logistics.planLoadError": "Ошибка загрузки",
    "logistics.planReorderSaved": "Порядок обновлён",
    "logistics.planReorderError": "Ошибка порядка",
    "logistics.planReorderSync": "Сохраняем порядок...",
    "logistics.planDraftCreated": "Черновик создан",
    "logistics.planEmpty": "Нет плана",
    "logistics.planNoDistance": "нет данных",
    "logistics.planNoEta": "нет данных",
    "logistics.planNoLoad": "нет данных",
    "logistics.planOptimizeError": "Ошибка оптимизации",
    "logistics.routeLoadChartTitle": "Нагрузка по маршрутам",
    "logistics.routeEtaChartTitle": "ETA по маршрутам",
    "logistics.loadBarTooltip": "Маршрут {{index}}: {{value}}",
    "logistics.etaBarTooltip": "Маршрут {{index}}: {{value}}",
    "logistics.planRouteShort": "М{{index}}",
    "logistics.overloadedBadge": "Перегрузка",
    "logistics.delayBadge": "Опоздание",
    "logistics.routeLoadLabel": "Загрузка",
    "logistics.routeEtaLabel": "ETA",
    "logistics.loadLabel": "Загрузка",
    "logistics.etaLabel": "ETA",
    "logistics.loadValue": "{{value}} кг",
    "logistics.etaHours": "{{count}} ч",
    "logistics.etaMinutes": "{{count}} мин",
    "logistics.onTime": "По графику",
    "logistics.delayLabel": "Опоздание {{minutes}} мин",
    "logistics.windowFrom": "с {{value}}",
    "logistics.windowTo": "до {{value}}",
    "logistics.windowUnknown": "Окно не задано",
    "logistics.coordinatesUpdating": "Обновляем координаты...",
    "logistics.coordinatesUpdated": "Координаты обновлены",
    "logistics.coordinatesUpdateError": "Ошибка координат",
    "logistics.recalculateInProgress": "Пересчёт...",
    "logistics.taskRecalculating": "Пересчёт",
    "logistics.stopTableHeaderStop": "Точка",
    "logistics.stopTableHeaderEta": "ETA",
    "logistics.stopTableHeaderLoad": "Загрузка",
    "logistics.stopTableHeaderWindow": "Окно",
    "logistics.stopTableHeaderDelay": "Опоздание",
    "logistics.stopPickup": "Погрузка №{{index}}",
    "logistics.stopDropoff": "Выгрузка №{{index}}",
    "logistics.stopPickupShort": "Погрузка",
    "logistics.stopDropoffShort": "Выгрузка",
  };
  const applyTemplate = (
    template: string,
    params: Record<string, unknown> = {},
  ) =>
    template.replace(/{{(.*?)}}/g, (_, token: string) => {
      const key = token.trim();
      const value = params[key];
      return value === undefined || value === null ? "" : String(value);
    });
  const translate = (key: string, options?: Record<string, unknown>) => {
    const template = templates[key];
    if (template) {
      return applyTemplate(template, options ?? {});
    }
    if (options && typeof options.defaultValue === "string") {
      return options.defaultValue;
    }
    return key;
  };
  const i18n = { language: "ru" };
  return {
    useTranslation: () => ({ t: translate, i18n }),
  };
});
jest.mock("leaflet/dist/leaflet.css", () => ({}));

const mockTasks = [
  {
    _id: "t1",
    id: "t1",
    title: "Задача 1",
    startCoordinates: { lat: 50, lng: 30 },
    finishCoordinates: { lat: 51, lng: 31 },
    logistics_details: {
      transport_type: "Легковой",
      start_location: "Київ",
      end_location: "Львів",
    },
  },
  {
    _id: "t2",
    id: "t2",
    title: "Задача 2",
    logistics_details: {
      transport_type: "Без транспорта",
      start_location: "",
      end_location: "",
    },
  },
  {
    _id: "t3",
    id: "t3",
    title: "Задача 3",
    logistics_details: {
      transport_type: "Легковой",
    },
  },
];

const layerGroupFactory = () => {
  const instance = {
    addTo: jest.fn().mockReturnThis(),
    clearLayers: jest.fn().mockReturnThis(),
    remove: jest.fn(),
  };
  return instance;
};

const markerFactory = () => {
  const instance = {
    bindTooltip: jest.fn().mockReturnThis(),
    addTo: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
  };
  return instance;
};

const polylineFactory = () => ({
  addTo: jest.fn().mockReturnThis(),
});

const mapInstance = {
  setView: jest.fn().mockReturnThis(),
  remove: jest.fn(),
  invalidateSize: jest.fn(),
};

const tileLayerFactory = () => ({
  addTo: jest.fn(),
  remove: jest.fn(),
});

jest.mock("leaflet", () => {
  const marker = jest.fn(() => markerFactory());
  const polyline = jest.fn(() => polylineFactory());
  const layerGroup = jest.fn(() => layerGroupFactory());
  const circleMarker = jest.fn(() => markerFactory());
  return {
    map: jest.fn(() => mapInstance),
    tileLayer: jest.fn(() => tileLayerFactory()),
    layerGroup,
    marker,
    polyline,
    divIcon: jest.fn(() => ({})),
    circleMarker,
  };
});

jest.mock("../components/TaskTable", () => {
  function MockTaskTable({ tasks, onDataChange }: any) {
    const signatureRef = React.useRef<string | null>(null);
    React.useEffect(() => {
      const signature = JSON.stringify(tasks);
      if (signatureRef.current === signature) return;
      signatureRef.current = signature;
      onDataChange(tasks);
    }, [tasks, onDataChange]);
    return React.createElement("div", { "data-testid": "task-table" });
  }
  return { __esModule: true, default: MockTaskTable };
});

const fetchTasksMock = jest.fn().mockResolvedValue({
  tasks: mockTasks,
  users: [],
  total: mockTasks.length,
});

jest.mock("../services/tasks", () => ({
  fetchTasks: (...args: unknown[]) => fetchTasksMock(...args),
}));

const baseVehicle = {
  id: "veh-1",
  name: "Погрузчик",
  registrationNumber: "AA 1234 BB",
  odometerInitial: 1000,
  odometerCurrent: 1200,
  mileageTotal: 200,
  payloadCapacityKg: 750,
  fuelType: "Бензин" as const,
  fuelRefilled: 50,
  fuelAverageConsumption: 0.1,
  fuelSpentTotal: 20,
  currentTasks: [] as string[],
  position: {
    lat: 10,
    lon: 20,
    speed: 12.5,
    updatedAt: "2099-01-01T00:00:00.000Z",
  },
};

const listFleetVehiclesMock = jest.fn();

jest.mock("../services/fleets", () => ({
  listFleetVehicles: (...args: unknown[]) => listFleetVehiclesMock(...args),
}));

jest.mock("../services/osrm", () =>
  jest.fn().mockResolvedValue([
    [30, 50],
    [31, 51],
  ]),
);

const optimizeRouteMock = jest.fn().mockResolvedValue(null);

jest.mock("../services/optimizer", () => ({
  __esModule: true,
  default: (...args: unknown[]) => optimizeRouteMock(...args),
}));

const listRoutePlansMock = jest.fn();
const updateRoutePlanMock = jest.fn();
const changeRoutePlanStatusMock = jest.fn();

jest.mock("../services/routePlans", () => ({
  listRoutePlans: (...args: unknown[]) => listRoutePlansMock(...args),
  updateRoutePlan: (...args: unknown[]) => updateRoutePlanMock(...args),
  changeRoutePlanStatus: (...args: unknown[]) => changeRoutePlanStatusMock(...args),
}));

const draftPlan: RoutePlan = {
  id: "plan-1",
  title: "Черновик маршрута",
  status: "draft",
  suggestedBy: null,
  method: "angle",
  count: 1,
  notes: null,
  metrics: {
    totalDistanceKm: 24.5,
    totalRoutes: 1,
    totalTasks: 1,
    totalStops: 2,
    totalEtaMinutes: 600,
    totalLoad: 12.3,
  },
  routes: [
    {
      id: "route-1",
      order: 0,
      vehicleId: null,
      vehicleName: null,
      driverId: null,
      driverName: null,
      tasks: [
        {
          taskId: "t1",
          order: 0,
          title: "Задача 1",
          start: { lat: 50, lng: 30 },
          finish: { lat: 51, lng: 31 },
          startAddress: "Старт",
          finishAddress: "Финиш",
          distanceKm: 12.3,
        },
      ],
      stops: [
        {
          order: 0,
          kind: "start",
          taskId: "t1",
          coordinates: { lat: 50, lng: 30 },
          address: "Старт",
          etaMinutes: 5,
          load: 12.3,
          delayMinutes: 0,
          windowStartMinutes: 480,
          windowEndMinutes: 540,
        },
        {
          order: 1,
          kind: "finish",
          taskId: "t1",
          coordinates: { lat: 51, lng: 31 },
          address: "Финиш",
          etaMinutes: 620,
          load: 0,
          delayMinutes: 80,
          windowStartMinutes: 480,
          windowEndMinutes: 540,
        },
      ],
      metrics: { distanceKm: 12.3, etaMinutes: 600, load: 12.3, tasks: 1, stops: 2 },
      routeLink: "https://example.com",
      notes: null,
    },
  ],
  tasks: ["t1"],
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

jest.mock("../context/useAuth", () => ({
  useAuth: () => ({ user: { telegram_id: 42, role: "admin" } }),
}));

jest.mock("../controllers/taskStateController", () => {
  const ReactActual = jest.requireActual<typeof import("react")>("react");
  const listeners = new Set<() => void>();
  const defaultKey = "logistics:all";
  const resolveKey = (value?: string) => value ?? defaultKey;
  let snapshot: any[] = [];
  let meta = {
    key: defaultKey,
    pageSize: 0,
    total: 0,
    sort: "desc" as const,
    updatedAt: Date.now(),
  };
  const notify = () => {
    listeners.forEach((listener) => listener());
  };
  const updateSnapshot = (rows: any[], key: string) => {
    snapshot = rows.map((task) => ({ ...task }));
    meta = {
      ...meta,
      key,
      pageSize: snapshot.length,
      total: snapshot.length,
      updatedAt: Date.now(),
    };
    notify();
  };
  const taskStateController = {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clear() {
      snapshot = [];
      meta = {
        ...meta,
        pageSize: 0,
        total: 0,
        updatedAt: Date.now(),
      };
      notify();
    },
    setIndex(_key: string, list: any[]) {
      const key = resolveKey(_key);
      updateSnapshot(Array.isArray(list) ? list : [], key);
    },
    getIndexSnapshot(_key: string) {
      const key = resolveKey(_key);
      if (meta.key !== key) {
        return [];
      }
      return snapshot;
    },
    getIndexMetaSnapshot(_key: string) {
      const key = resolveKey(_key);
      if (meta.key !== key) {
        return {
          ...meta,
          key,
        };
      }
      return { ...meta };
    },
  };
  const useTaskIndex = (_key = defaultKey) => {
    const key = resolveKey(_key);
    const [value, setValue] = ReactActual.useState(() =>
      taskStateController.getIndexSnapshot(key),
    );
    ReactActual.useEffect(() => {
      const listener = () => {
        setValue([...taskStateController.getIndexSnapshot(key)]);
      };
      const unsubscribe = taskStateController.subscribe(listener);
      listener();
      return unsubscribe;
    }, [key]);
    return value;
  };
  const useTaskIndexMeta = (_key = defaultKey) => {
    const key = resolveKey(_key);
    const [value, setValue] = ReactActual.useState(() =>
      taskStateController.getIndexMetaSnapshot(key),
    );
    ReactActual.useEffect(() => {
      const listener = () => {
        setValue(taskStateController.getIndexMetaSnapshot(key));
      };
      const unsubscribe = taskStateController.subscribe(listener);
      listener();
      return unsubscribe;
    }, [key]);
    return value;
  };
  return {
    __esModule: true,
    taskStateController,
    useTaskIndex,
    useTaskIndexMeta,
  };
});

jest.mock("../context/useTasks", () => {
  const { taskStateController } = jest.requireMock(
    "../controllers/taskStateController",
  );
  return {
    __esModule: true,
    default: () => ({
      controller: taskStateController,
      version: 0,
      refresh: jest.fn(),
      query: "",
      setQuery: jest.fn(),
      filters: {
        status: [],
        priority: [],
        from: "",
        to: "",
        taskTypes: [],
        assignees: [],
      },
      setFilters: jest.fn(),
      filterUsers: [],
      setFilterUsers: jest.fn(),
    }),
  };
});

describe("LogisticsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchTasksMock.mockResolvedValue({
      tasks: mockTasks,
      users: [],
      total: mockTasks.length,
    });
    taskStateController.clear();
    listRoutePlansMock.mockReset();
    updateRoutePlanMock.mockReset();
    changeRoutePlanStatusMock.mockReset();
    optimizeRouteMock.mockReset();
    optimizeRouteMock.mockResolvedValue(null);
    listRoutePlansMock
      .mockResolvedValueOnce({ items: [draftPlan], total: 1 })
      .mockResolvedValue({ items: [], total: 0 });
    updateRoutePlanMock.mockResolvedValue(draftPlan);
    changeRoutePlanStatusMock.mockResolvedValue({
      ...draftPlan,
      status: "approved",
    });
    listFleetVehiclesMock.mockReset();
    listFleetVehiclesMock.mockResolvedValue({
      items: [{ ...baseVehicle }],
      total: 1,
      page: 1,
      limit: 100,
    });
  });

  it("отображает список транспорта и позволяет вручную обновить", async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true }}>
        <LogisticsPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(listRoutePlansMock).toHaveBeenCalledWith("draft", 1, 1),
    );

    await waitFor(() =>
      expect(
        screen.getByDisplayValue("Черновик маршрута"),
      ).toBeInTheDocument(),
    );

    await waitFor(() => expect(listFleetVehiclesMock).toHaveBeenCalledTimes(1));

    expect(listFleetVehiclesMock).toHaveBeenCalledWith("", 1, 100);

    expect(screen.getByText("Погрузчик")).toBeInTheDocument();

    await waitFor(() =>
      expect(
        taskStateController.getIndexSnapshot("logistics:all"),
      ).toHaveLength(1),
    );

    const refreshButton = screen.getByRole("button", {
      name: "Обновить автопарк",
    });

    fireEvent.click(refreshButton);

    await waitFor(() =>
      expect(listFleetVehiclesMock).toHaveBeenCalledTimes(2),
    );
  });

  it("показывает аналитику плана, прогресс-бары и таблицу остановок", async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true }}>
        <LogisticsPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByDisplayValue("Черновик маршрута")).toBeInTheDocument(),
    );

    expect(screen.getAllByText("Итоги плана").length).toBeGreaterThan(0);
    expect(screen.getByText("Время в пути")).toBeInTheDocument();
    expect(screen.getAllByText("Загрузка").length).toBeGreaterThan(0);
    expect(screen.getAllByText("10 ч").length).toBeGreaterThan(0);
    expect(screen.getAllByText("12,3 кг").length).toBeGreaterThan(0);

    const routeHeading = await screen.findByRole("heading", {
      level: 4,
      name: "Маршрут 1",
    });
    const routeCard = routeHeading.closest("div")?.parentElement?.parentElement;
    expect(routeCard).not.toBeNull();
    if (!routeCard) {
      throw new Error("Маршрутный блок не найден");
    }
    const progressBars = within(routeCard).getAllByRole("progressbar");
    expect(progressBars).toHaveLength(2);
    expect(progressBars[0]).toHaveAttribute("aria-valuenow", "100");
    expect(progressBars[1]).toHaveAttribute("aria-valuenow", "100");
    expect(within(routeCard).getByText("Перегрузка")).toBeInTheDocument();
    expect(within(routeCard).getAllByText("Опоздание").length).toBeGreaterThan(0);

    const stopsTable = screen.getByRole("table");
    expect(within(stopsTable).getByText("Погрузка №1")).toBeInTheDocument();
    expect(within(stopsTable).getByText("Выгрузка №2")).toBeInTheDocument();
    expect(within(stopsTable).getAllByText("08:00 – 09:00").length).toBeGreaterThan(0);
    expect(within(stopsTable).getByText("Опоздание 80 мин")).toBeInTheDocument();
    expect(within(stopsTable).getAllByText("12,3 кг").length).toBeGreaterThan(0);
  });

  it("обновляет черновик после оптимизации и показывает ETA и загрузку", async () => {
    const optimizationResult: RouteOptimizationResult = {
      routes: [
        {
          vehicleIndex: 0,
          taskIds: ["t1"],
          distanceKm: 15.2,
          etaMinutes: 125,
          load: 7.5,
        },
      ],
      totalDistanceKm: 15.2,
      totalEtaMinutes: 125,
      totalLoad: 7.5,
      warnings: [],
    };
    optimizeRouteMock.mockResolvedValueOnce(optimizationResult);

    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true }}>
        <LogisticsPage />
      </MemoryRouter>,
    );

    const optimizeButton = await screen.findByRole("button", {
      name: "Просчёт логистики",
    });

    expect(screen.getAllByText("10 ч").length).toBeGreaterThan(0);

    fireEvent.click(optimizeButton);

    await waitFor(() => expect(optimizeRouteMock).toHaveBeenCalled());

    await waitFor(() =>
      expect(
        screen.getByText(
          "Черновик создан · ETA: 2 ч 5 мин · Загрузка: 7,5 кг",
        ),
      ).toBeInTheDocument(),
    );

    expect(screen.getAllByText("2 ч 5 мин").length).toBeGreaterThan(0);
    expect(screen.getAllByText("7,5 кг").length).toBeGreaterThan(0);
  });

  it("учитывает задачи только с точкой выгрузки при оптимизации", async () => {
    const dropTask = {
      _id: "drop-1",
      id: "drop-1",
      title: "Выгрузка в Харкове",
      finishCoordinates: { lat: 50.004, lng: 36.231 },
      logistics_details: {
        transport_type: "Грузовой",
        start_location: "",
        end_location: "Харків, вул. Сумська, 1",
      },
      delivery_window_start: "2099-01-01T08:00:00+02:00",
      delivery_window_end: "2099-01-01T11:00:00+02:00",
    };

    fetchTasksMock.mockResolvedValue({
      tasks: [dropTask],
      users: [],
      total: 1,
    });

    const optimizationResult: RouteOptimizationResult = {
      routes: [
        {
          vehicleIndex: 0,
          taskIds: [dropTask._id],
          distanceKm: 18.5,
          etaMinutes: 95,
          load: 3.2,
        },
      ],
      totalDistanceKm: 18.5,
      totalEtaMinutes: 95,
      totalLoad: 3.2,
      warnings: [],
    };

    optimizeRouteMock.mockResolvedValueOnce(optimizationResult);

    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true }}>
        <LogisticsPage />
      </MemoryRouter>,
    );

    const optimizeButton = await screen.findByRole("button", {
      name: "Просчёт логистики",
    });

    fireEvent.click(optimizeButton);

    await waitFor(() => expect(optimizeRouteMock).toHaveBeenCalled());

    const payload = optimizeRouteMock.mock.calls[0][0] as OptimizeRoutePayload;
    const dropPayload = payload.tasks.find((task) => task.id === dropTask._id);
    expect(dropPayload).toBeDefined();
    expect(dropPayload?.coordinates).toEqual(dropTask.finishCoordinates);
    expect(dropPayload?.startAddress).toBeUndefined();
    expect(dropPayload?.finishAddress).toBe("Харків, вул. Сумська, 1");
    expect(dropPayload?.timeWindow).toEqual([480, 660]);

    await waitFor(() =>
      expect(screen.getByText("Выгрузка в Харкове")).toBeInTheDocument(),
    );

    const taskCard = screen.getByText("Выгрузка в Харкове").closest("li");
    expect(taskCard).not.toBeNull();
    if (!taskCard) {
      throw new Error("Карточка задачи не найдена");
    }
    expect(within(taskCard).queryByText(/startPoint/i)).toBeNull();
    expect(within(taskCard).getByText(/endPoint/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Выгрузка №/i).length).toBeGreaterThan(0);
  });
});
