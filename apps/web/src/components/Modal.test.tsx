/** @jest-environment jsdom */
// Назначение файла: проверяет, что Modal не рендерится при закрытом состоянии.
// Основные модули: React, @testing-library/react, Modal.
import React from "react";
import { render } from "@testing-library/react";
import Modal from "./Modal";

describe("Modal", () => {
  it("не рендерится когда закрыт", () => {
    const { container } = render(
      <Modal open={false} onClose={() => {}}>
        <div>child</div>
      </Modal>,
    );
    expect(container.firstChild).toBeNull();
  });
});
