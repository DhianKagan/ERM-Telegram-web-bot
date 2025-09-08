/** @jest-environment jsdom */
// Назначение файла: проверяет наличие селекторов в DepartmentManager.
// Основные модули: React, @testing-library/react, DepartmentManager.
import React from "react";
import { render } from "@testing-library/react";
import DepartmentManager from "./DepartmentManager";

describe("DepartmentManager", () => {
  it("рендерит поле названия", () => {
    const { container } = render(<DepartmentManager onSubmit={() => {}} />);
    expect(
      container.querySelector(DepartmentManager.selectors.nameInput),
    ).not.toBeNull();
  });
});
