/** @jest-environment jsdom */
// Назначение: тесты страницы логистики с отображением техники и треков
// Основные модули: React, @testing-library/react, Leaflet-моки

import "@testing-library/jest-dom";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LogisticsPage from "./Logistics";
import { taskStateController } from "../controllers/taskStateController";
import type { RoutePlan } from "shared";
import type {
  LiveTrackingDisconnect,
  LiveTrackingOptions,
} from "../services/liveTracking";
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
      "logistics.refreshFleet": "Обновить технику",
      "logistics.trackLabel": "Показывать трек",
      "logistics.trackWindowLabel": "История трека: {{hours}} ч",
      "logistics.autoRefresh": "Автообновление",
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
      "logistics.metaDescription": "Контроль логистики и маршрутов",
    };
    return dictionary[key] ?? key;
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
};

const tileLayerFactory = () => ({
  addTo: jest.fn(),
});

jest.mock("leaflet", () => {
  const marker = jest.fn(() => markerFactory());
  const polyline = jest.fn(() => polylineFactory());
  const layerGroup = jest.fn(() => layerGroupFactory());
  return {
    map: jest.fn(() => mapInstance),
    tileLayer: jest.fn(() => tileLayerFactory()),
    layerGroup,
    marker,
    polyline,
    divIcon: jest.fn(() => ({})),
  };
});

const mockedLeaflet = jest.requireMock("leaflet");

jest.mock("../components/Breadcrumbs", () => () => <nav data-testid="breadcrumbs" />);

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

jest.mock("../services/optimizer", () => jest.fn().mockResolvedValue(null));

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
  let snapshot: any[] = [];
  let meta = {
    key: "logistics:all",
    pageSize: 0,
    total: 0,
    sort: "desc" as const,
    updatedAt: Date.now(),
  };
  const notify = () => {
    listeners.forEach((listener) => listener());
  };
  const updateSnapshot = (rows: any[]) => {
    snapshot = rows.map((task) => ({ ...task }));
    meta = {
      ...meta,
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
      updateSnapshot(Array.isArray(list) ? list : []);
    },
    getIndexSnapshot() {
      return snapshot;
    },
    getIndexMetaSnapshot() {
      return { ...meta };
    },
  };
  const useTaskIndex = () => {
    const [value, setValue] = ReactActual.useState(() => snapshot);
    ReactActual.useEffect(() => {
      const listener = () => {
        setValue([...snapshot]);
      };
      const unsubscribe = taskStateController.subscribe(listener);
      listener();
      return unsubscribe;
    }, []);
    return value;
  };
  const useTaskIndexMeta = () => {
    const [value, setValue] = ReactActual.useState(() =>
      taskStateController.getIndexMetaSnapshot(),
    );
    ReactActual.useEffect(() => {
      const listener = () => {
        setValue(taskStateController.getIndexMetaSnapshot());
      };
      const unsubscribe = taskStateController.subscribe(listener);
      listener();
      return unsubscribe;
    }, []);
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

const disconnectLiveTrackingMock = jest.fn<ReturnType<LiveTrackingDisconnect>, []>(() =>
  undefined,
);
const connectLiveTrackingMock = jest.fn<
  LiveTrackingDisconnect,
  [LiveTrackingOptions | undefined]
>(() => disconnectLiveTrackingMock);

jest.mock("../services/liveTracking", () => ({
  connectLiveTracking: (options?: LiveTrackingOptions) =>
    connectLiveTrackingMock(options),
}));

describe("LogisticsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    disconnectLiveTrackingMock.mockClear();
    connectLiveTrackingMock.mockClear();
    fetchTasksMock.mockResolvedValue(mockTasks);
    taskStateController.clear();
    listRoutePlansMock.mockReset();
    updateRoutePlanMock.mockReset();
    changeRoutePlanStatusMock.mockReset();
    listRoutePlansMock
      .mockResolvedValueOnce({ items: [draftPlan], total: 1 })
      .mockResolvedValue({ items: [], total: 0 });
    updateRoutePlanMock.mockResolvedValue(draftPlan);
    changeRoutePlanStatusMock.mockResolvedValue({
      ...draftPlan,
      status: "approved",
    });
    listFleetVehiclesMock.mockReset();
    listFleetVehiclesMock
      .mockResolvedValueOnce({
        items: [{ ...baseVehicle }],
        total: 1,
        page: 1,
        limit: 100,
      })
      .mockResolvedValue({
        items: [
          {
            ...baseVehicle,
            track: [
              {
                lat: 10,
                lon: 20,
                timestamp: "2099-01-01T00:00:00.000Z",
              },
              {
                lat: 11,
                lon: 21,
                timestamp: "2099-01-01T00:10:00.000Z",
              },
            ],
          },
        ],
        total: 1,
        page: 1,
        limit: 100,
      });
  });

  it("отображает маркеры техники и трек после включения", async () => {
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

    await waitFor(() =>
      expect(mockedLeaflet.marker).toHaveBeenCalledWith(
        [10, 20],
        expect.objectContaining({ title: "Погрузчик" }),
      ),
    );

    const trackToggle = screen.getByLabelText("Показывать трек");
    fireEvent.click(trackToggle);

    await waitFor(() =>
      expect(listFleetVehiclesMock).toHaveBeenCalledTimes(2),
    );

    await waitFor(() => {
      const hasTrackPolyline = mockedLeaflet.polyline.mock.calls.some(
        ([coords, options]: [unknown, unknown]) => {
          if (!Array.isArray(coords) || coords.length < 2) return false;
          const [start, finish] = coords as [
            [number, number],
            [number, number],
          ];
          const color = (options as { color?: string } | undefined)?.color;
          return (
            Array.isArray(start) &&
            Array.isArray(finish) &&
            start[0] === 10 &&
            start[1] === 20 &&
            finish[0] === 11 &&
            finish[1] === 21 &&
            color === "#22c55e"
          );
        },
      );
      expect(hasTrackPolyline).toBe(true);
    });
  });
});
