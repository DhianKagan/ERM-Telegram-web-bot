/** @jest-environment jsdom */
// Назначение файла: проверяет наличие селекторов в FleetManager.
// Основные модули: React, @testing-library/react, FleetManager.
import React from "react";
import { render } from "@testing-library/react";
import FleetManager from "./FleetManager";

describe("FleetManager", () => {
  it("рендерит поля названия и токена", () => {
    const { container } = render(<FleetManager onSubmit={() => {}} />);
    expect(
      container.querySelector(FleetManager.selectors.nameInput),
    ).not.toBeNull();
    expect(
      container.querySelector(FleetManager.selectors.tokenInput),
    ).not.toBeNull();
  });

  it("отображает кнопки управления токеном", () => {
    const { container } = render(<FleetManager onSubmit={() => {}} />);
    expect(
      container.querySelector(FleetManager.selectors.toggleTokenButton),
    ).not.toBeNull();
    const copyButton = container.querySelector(
      FleetManager.selectors.copyTokenButton,
    ) as HTMLButtonElement | null;
    expect(copyButton).not.toBeNull();
    expect(copyButton?.disabled).toBe(true);
  });
});
