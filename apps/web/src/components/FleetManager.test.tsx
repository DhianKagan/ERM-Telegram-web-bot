/** @jest-environment jsdom */
// Назначение файла: проверяет наличие селекторов в FleetManager.
// Основные модули: React, @testing-library/react, FleetManager.
import React from "react";
import { render } from "@testing-library/react";
import FleetManager from "./FleetManager";

describe("FleetManager", () => {
  it("рендерит поле названия", () => {
    const { container } = render(<FleetManager onSubmit={() => {}} />);
    expect(
      container.querySelector(FleetManager.selectors.nameInput),
    ).not.toBeNull();
  });
});
