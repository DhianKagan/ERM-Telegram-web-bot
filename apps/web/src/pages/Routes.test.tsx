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
    updatedAt: "2024-05-05T12:00:00.000Z",
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

jest.mock("../services/optimizer", () => jest.fn().mockResolvedValue({ routes: [] }));

jest.mock("../utils/createMultiRouteLink", () => jest.fn().mockReturnValue("https://example.com"));

jest.mock("../context/useAuth", () => ({
  useAuth: () => ({ user: { telegram_id: 42, role: "admin" } }),
}));

describe("RoutesPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchTasksMock.mockResolvedValue(mockTasks);
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
                timestamp: "2024-05-05T12:00:00.000Z",
              },
              {
                lat: 11,
                lon: 21,
                timestamp: "2024-05-05T12:10:00.000Z",
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
      <MemoryRouter>
        <RoutesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(listFleetVehiclesMock).toHaveBeenCalledTimes(1));

    expect(listFleetVehiclesMock).toHaveBeenCalledWith("", 1, 100);

    await waitFor(() =>
      expect(mockedLeaflet.marker).toHaveBeenCalledWith(
        [10, 20],
        expect.objectContaining({ title: "Погрузчик" }),
      ),
    );

    const trackToggle = screen.getByLabelText("Показывать трек (1 час)");
    fireEvent.click(trackToggle);

    await waitFor(() =>
      expect(listFleetVehiclesMock).toHaveBeenCalledTimes(2),
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
