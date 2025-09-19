/** @jest-environment jsdom */
// Назначение: проверяет устойчивость FleetVehiclesGrid к некорректным датчикам.
// Основные модули: React, @testing-library/react, FleetVehiclesGrid.
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import FleetVehiclesGrid from "./FleetVehiclesGrid";
import type { VehicleDto } from "shared";

describe("FleetVehiclesGrid", () => {
  const baseVehicle: VehicleDto = {
    id: "veh-1",
    unitId: 101,
    name: "Тестовая машина",
    sensors: [],
  };

  it("корректно обрабатывает customSensors со значением null", () => {
    render(
      <FleetVehiclesGrid
        vehicles={[
          {
            ...baseVehicle,
            customSensors: [
              null as unknown as VehicleDto["sensors"][number],
              { name: undefined, value: null } as unknown as VehicleDto["sensors"][number],
            ],
          },
        ]}
        loading={false}
        error={undefined}
        onRefresh={() => {}}
        onEdit={() => {}}
      />,
    );

    expect(screen.getByText("Дополнительные датчики")).toBeInTheDocument();
    const listItems = screen.getAllByRole("listitem");
    expect(listItems).toHaveLength(1);
    expect(listItems[0]).toHaveTextContent(/—\s*:\s*—/);
  });
});
