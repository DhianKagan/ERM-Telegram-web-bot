/** @jest-environment jsdom */
// Назначение: тесты страницы логистики с отображением техники и треков
// Основные модули: React, @testing-library/react, MapLibre-моки

import "@testing-library/jest-dom";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import LogisticsPage from "./Logistics";
import { taskStateController } from "../controllers/taskStateController";
import type { RoutePlan } from "shared";
jest.mock("react-i18next", () => {
  const translate = (key: string, options?: Record<string, unknown>) => {
    if (key === "logistics.selectedVehicle") {
      return `Выбран транспорт: ${options?.name ?? ""}`.trim();
    }
    if (key === "logistics.linksLabel") {
      return `Маршрут ${options?.index ?? ""}`.trim();
    }
    if (key === "logistics.planRouteTitle") {
      return `Маршрут ${options?.index ?? ""}`.trim();
    }
    if (key === "logistics.planRouteSummary") {
      return `Задач: ${options?.tasks ?? ""}, остановок: ${options?.stops ?? ""}`.trim();
    }
    if (key === "logistics.planRouteDistance") {
      return `Расстояние: ${options?.distance ?? ""}`.trim();
    }
    const dictionary: Record<string, string> = {
      loading: "Загрузка...",
      reset: "Сбросить",
      refresh: "Обновить",
      "logistics.title": "Логистика",
      "logistics.transport": "Транспорт",
      "logistics.unselectedVehicle": "Не выбран",
      "logistics.refreshFleet": "Обновить автопарк",
      "logistics.noVehicles": "Транспорт не найден",
      "logistics.loadError": "Не удалось загрузить транспорт автопарка",
      "logistics.adminOnly": "Автопарк доступен только администраторам",
      "logistics.noAccess": "Нет доступа к автопарку",
      "logistics.optimize": "Просчёт логистики",
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
      "logistics.planRouteEmpty": "Нет задач",
      "logistics.planDriver": "Водитель",
      "logistics.planVehicle": "Транспорт",
      "logistics.planRouteNotes": "Заметки по маршруту",
      "logistics.planTaskUp": "Вверх",
      "logistics.planTaskDown": "Вниз",
      "logistics.planSaved": "Сохранено",
      "logistics.planSaveError": "Ошибка сохранения",
      "logistics.planPublished": "Опубликовано",
      "logistics.planCompleted": "Завершено",
      "logistics.planStatusError": "Ошибка статуса",
      "logistics.planLoadError": "Ошибка загрузки",
      "logistics.planDraftCreated": "Черновик создан",
      "logistics.planEmpty": "Нет плана",
      "logistics.planNoDistance": "нет данных",
      "logistics.planOptimizeError": "Ошибка оптимизации",
      "logistics.tasksHeading": "Задачи",
      "logistics.metaTitle": "Логистика — ERM",
      "logistics.metaDescription": "Планирование маршрутов, управление автопарком и анализ доставок по агрегированным данным.",
      "logistics.geozonesTitle": "Геозоны",
      "logistics.geozonesDraw": "Нарисовать зону",
      "logistics.geozonesDrawing": "Рисуем…",
      "logistics.geozonesHint": "Выберите геозоны, чтобы ограничить задачи на карте.",
      "logistics.geozonesEmpty": "Геозоны пока не созданы",
      "logistics.geozoneDefaultName": "Зона {{index}}",
      "logistics.geozoneRemove": "Удалить",
      "logistics.geozoneStatusActive": "Активна",
      "logistics.geozoneStatusInactive": "Неактивна",
      "logistics.geozoneArea": "Площадь: {{value}}",
      "logistics.geozonePerimeter": "Периметр: {{value}}",
      "logistics.geozoneBuffer": "Буфер: {{value}}",
      "logistics.viewModeLabel": "Режим карты",
      "logistics.viewModePlanar": "2D",
      "logistics.viewModeTilted": "Перспектива",
      "logistics.legendTitle": "Легенда",
      "logistics.legendCount": "({{count}})",
      "logistics.legendStart": "Старт задачи",
      "logistics.legendFinish": "Финиш задачи",
      "logistics.legendMovement": "Движение по маршруту",
      "logistics.vehicleTasksCount": "Задач: {{count}}",
      "logistics.vehicleMileage": "Пробег: {{value}} км",
      "logistics.vehicleCountLabel": "Машины",
      "logistics.vehicleCountAria": "Количество машин",
      "logistics.optimizeMethodLabel": "Метод",
      "logistics.optimizeMethodAria": "Метод оптимизации",
    };
    if (dictionary[key]) {
      let template = dictionary[key];
      if (options) {
        template = template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, token) => {
          if (Object.prototype.hasOwnProperty.call(options, token)) {
            const value = options[token];
            return value === undefined || value === null
              ? ""
              : String(value);
          }
          return `{{${token}}}`;
        });
      }
      return template;
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
jest.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}), { virtual: true });
jest.mock("@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css", () => ({}), {
  virtual: true,
});

const buildMapInstance = () => {
  const sources = new Map<string, { setData: jest.Mock }>();
  const layers = new Map<string, any>();
  const handlers = new Map<string, Set<(...args: any[]) => void>>();
  const getKey = (event: string, layerId?: string) =>
    layerId ? `${event}:${layerId}` : event;
  const getHandlers = (event: string, layerId?: string) => {
    const key = getKey(event, layerId);
    let bucket = handlers.get(key);
    if (!bucket) {
      bucket = new Set();
      handlers.set(key, bucket);
    }
    return bucket;
  };
  const instance: any = {
    on: jest.fn(
      (
        event: string,
        layerOrHandler: string | ((...args: any[]) => void),
        maybeHandler?: (...args: any[]) => void,
      ) => {
        let layerId: string | undefined;
        let handler: (...args: any[]) => void;
        if (typeof layerOrHandler === "string") {
          layerId = layerOrHandler;
          handler = maybeHandler as (...args: any[]) => void;
        } else {
          handler = layerOrHandler;
        }
        getHandlers(event, layerId).add(handler);
        if (event === "load") {
          handler({});
        }
        return instance;
      },
    ),
    off: jest.fn(
      (
        event: string,
        layerOrHandler: string | ((...args: any[]) => void),
        maybeHandler?: (...args: any[]) => void,
      ) => {
        let layerId: string | undefined;
        let handler: (...args: any[]) => void;
        if (typeof layerOrHandler === "string") {
          layerId = layerOrHandler;
          handler = maybeHandler as (...args: any[]) => void;
        } else {
          handler = layerOrHandler;
        }
        getHandlers(event, layerId).delete(handler);
        return instance;
      },
    ),
    addControl: jest.fn(),
    addSource: jest.fn((id: string) => {
      const source = { setData: jest.fn() };
      sources.set(id, source);
      return source;
    }),
    addLayer: jest.fn((layer: { id: string }) => {
      layers.set(layer.id, layer);
    }),
    getSource: jest.fn((id: string) => sources.get(id)),
    getLayer: jest.fn((id: string) => layers.get(id)),
    setLayoutProperty: jest.fn(),
    remove: jest.fn(),
    resize: jest.fn(),
    easeTo: jest.fn(),
    setPitch: jest.fn(),
    setBearing: jest.fn(),
    getZoom: jest.fn(() => 6),
    getCanvas: jest.fn(() => ({ style: { cursor: "" } })),
    dragRotate: { enable: jest.fn(), disable: jest.fn() },
    touchZoomRotate: {
      enableRotation: jest.fn(),
      disableRotation: jest.fn(),
    },
  };
  instance.__handlers = handlers;
  instance.__emit = (event: string, payload: any, layerId?: string) => {
    for (const handler of getHandlers(event, layerId)) {
      handler(payload);
    }
  };
  return instance;
};

jest.mock(
  "maplibre-gl",
  () => {
    const Marker = jest.fn(() => ({
      setLngLat: jest.fn().mockReturnThis(),
      addTo: jest.fn().mockReturnThis(),
      remove: jest.fn(),
    }));
    const NavigationControl = jest.fn();
    const Map = jest.fn(() => buildMapInstance());
    return {
      __esModule: true,
      default: { Map, Marker, NavigationControl },
      Map,
      Marker,
      NavigationControl,
    };
  },
  { virtual: true },
);

const drawChangeMode = jest.fn();
const drawDelete = jest.fn();
const optimizeRouteMock = jest.fn().mockResolvedValue(null);

jest.mock(
  "@mapbox/mapbox-gl-draw",
  () =>
    jest.fn().mockImplementation(() => ({
      changeMode: drawChangeMode,
      delete: drawDelete,
      get: jest.fn(() => null),
    })),
  { virtual: true },
);

const mockTasks = [
  {
    _id: "t1",
    id: "t1",
    title: "Задача 1",
    status: "Новая",
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
    status: "В работе",
    startCoordinates: { lat: 55, lng: 35 },
    finishCoordinates: { lat: 55.5, lng: 35.5 },
    logistics_details: {
      transport_type: "Грузовой",
      start_location: "Дніпро",
      end_location: "Харків",
    },
  },
  {
    _id: "t3",
    id: "t3",
    title: "Задача 3",
    status: "Отменена",
    logistics_details: {
      transport_type: "Легковой",
    },
  },
];

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

const fetchTasksMock = jest.fn().mockResolvedValue(mockTasks);

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
        },
        {
          order: 1,
          kind: "finish",
          taskId: "t1",
          coordinates: { lat: 51, lng: 31 },
          address: "Финиш",
        },
      ],
      metrics: { distanceKm: 12.3, tasks: 1, stops: 2 },
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

beforeAll(() => {
  if (!globalThis.crypto) {
    Object.defineProperty(globalThis, "crypto", {
      value: { randomUUID: () => "test-uuid" },
      configurable: true,
    });
  } else if (typeof globalThis.crypto.randomUUID !== "function") {
    (globalThis.crypto as Crypto).randomUUID = () => "test-uuid";
  }
});

describe("LogisticsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchTasksMock.mockResolvedValue(mockTasks);
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
      ).toHaveLength(2),
    );

    const refreshButton = screen.getByRole("button", {
      name: "Обновить автопарк",
    });

    fireEvent.click(refreshButton);

    await waitFor(() =>
      expect(listFleetVehiclesMock).toHaveBeenCalledTimes(2),
    );
  });

  it("фильтрует задачи по геозоне и учитывает статусы", async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true }}>
        <LogisticsPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(
        taskStateController.getIndexSnapshot("logistics:all"),
      ).toHaveLength(2),
    );

    const mapModule = jest.requireMock("maplibre-gl");
    const mapInstance = mapModule.Map.mock.results[0]?.value as any;
    expect(mapInstance).toBeTruthy();

    await waitFor(() => {
      const handlers: Set<(...args: unknown[]) => void> | undefined =
        mapInstance.__handlers?.get("draw.create");
      expect(handlers && handlers.size > 0).toBe(true);
    });

    const polygon = {
      type: "Feature" as const,
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [29.5, 49.5],
            [29.5, 51.5],
            [31.5, 51.5],
            [31.5, 49.5],
            [29.5, 49.5],
          ],
        ],
      },
      properties: {},
    };

    act(() => {
      mapInstance.__emit("draw.create", { features: [polygon] });
    });

    const zoneCheckbox = await screen.findByRole("checkbox", {
      name: "Зона 1",
    });
    expect(zoneCheckbox).not.toBeChecked();
    expect(await screen.findByText("Неактивна")).toBeInTheDocument();
    fireEvent.click(zoneCheckbox);
    expect(zoneCheckbox).toBeChecked();
    expect(await screen.findByText("Активна")).toBeInTheDocument();

    const areaElement = await screen.findByText(/Площадь:/);
    expect(areaElement).not.toHaveTextContent("—");
    expect(screen.getByText(/Периметр:/)).not.toHaveTextContent("—");
    expect(screen.getByText(/Буфер:/)).not.toHaveTextContent("—");

    const legendHeading = screen.getByRole("heading", { name: "Легенда" });
    const legendSection = legendHeading.closest("section");
    expect(legendSection).toBeTruthy();
    const legendList = within(legendSection as HTMLElement).getByRole("list");
    await waitFor(() =>
      expect(
        taskStateController.getIndexSnapshot("logistics:all"),
      ).toEqual([expect.objectContaining({ _id: "t1" })]),
    );
    await waitFor(() =>
      expect(within(legendList).queryAllByText("(1)")).toHaveLength(1),
    );
    const novaLegendItem = within(legendList)
      .getAllByRole("listitem")
      .find((item) => item.textContent?.includes("Новая"));
    expect(novaLegendItem).toBeTruthy();
    await waitFor(() =>
      expect(
        within(novaLegendItem as HTMLElement).getByText("(1)"),
      ).toBeInTheDocument(),
    );

    const optimizeButton = screen.getByRole("button", {
      name: "Просчёт логистики",
    });
    fireEvent.click(optimizeButton);

    await waitFor(() =>
      expect(optimizeRouteMock).toHaveBeenCalledWith(["t1"], 1, "angle"),
    );
  });
});
