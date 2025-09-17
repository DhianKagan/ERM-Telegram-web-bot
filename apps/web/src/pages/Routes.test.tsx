/** @jest-environment jsdom */
// Назначение: тесты страницы маршрутов с отображением техники и треков
// Основные модули: React, @testing-library/react, Leaflet-моки

import "@testing-library/jest-dom";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RoutesPage from "./Routes";
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
    React.useEffect(() => {
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

const fetchCollectionItemsMock = jest.fn().mockResolvedValue({
  items: [{ _id: "fleet-1", name: "Основной флот", value: "" }],
  total: 1,
});

jest.mock("../services/collections", () => ({
  fetchCollectionItems: (...args: unknown[]) => fetchCollectionItemsMock(...args),
}));

const fetchFleetVehiclesMock = jest
  .fn()
  .mockImplementation(async (_fleetId: string, params?: { track?: boolean }) => ({
    fleet: { id: "fleet-1", name: "Основной флот" },
    vehicles: [
      {
        id: "veh-1",
        unitId: 1,
        name: "Погрузчик",
        sensors: [],
        position: {
          lat: 10,
          lon: 20,
          speed: 12.5,
          updatedAt: "2024-05-05T12:00:00.000Z",
        },
        track: params?.track
          ? [
              {
                lat: 10,
                lon: 20,
                timestamp: "2024-05-05T12:00:00.000Z",
              },
              {
                lat: 11,
                lon: 21,
                timestamp: "2024-05-05T12:10:00.000Z",
              },
            ]
          : undefined,
      },
    ],
  }));

jest.mock("../services/fleets", () => ({
  fetchFleetVehicles: (...args: unknown[]) => fetchFleetVehiclesMock(...args),
}));

jest.mock("../services/osrm", () =>
  jest.fn().mockResolvedValue([
    [30, 50],
    [31, 51],
  ]),
);

jest.mock("../services/optimizer", () => jest.fn().mockResolvedValue({ routes: [] }));

jest.mock("../utils/createMultiRouteLink", () => jest.fn().mockReturnValue("https://example.com"));

jest.mock("../context/useAuth", () => ({
  useAuth: () => ({ user: { telegram_id: 42, role: "admin" } }),
}));

describe("RoutesPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchTasksMock.mockResolvedValue(mockTasks);
    fetchCollectionItemsMock.mockResolvedValue({
      items: [{ _id: "fleet-1", name: "Основной флот", value: "" }],
      total: 1,
    });
  });

  it("отображает маркеры техники и трек после включения", async () => {
    render(
      <MemoryRouter>
        <RoutesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(fetchFleetVehiclesMock).toHaveBeenCalledTimes(1));

    expect(fetchFleetVehiclesMock).toHaveBeenCalledWith("fleet-1", undefined);

    await waitFor(() =>
      expect(mockedLeaflet.marker).toHaveBeenCalledWith(
        [10, 20],
        expect.objectContaining({ title: "Погрузчик" }),
      ),
    );

    const trackToggle = screen.getByLabelText("Показывать трек (1 час)");
    fireEvent.click(trackToggle);

    await waitFor(() =>
      expect(fetchFleetVehiclesMock).toHaveBeenLastCalledWith(
        "fleet-1",
        expect.objectContaining({ track: true }),
      ),
    );

    await waitFor(() =>
      expect(mockedLeaflet.polyline).toHaveBeenCalledWith(
        [
          [10, 20],
          [11, 21],
        ],
        expect.objectContaining({ color: "#8b5cf6" }),
      ),
    );
  });
});
