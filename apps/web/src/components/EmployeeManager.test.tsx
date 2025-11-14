/** @jest-environment jsdom */
// Назначение файла: проверяет наличие селекторов в EmployeeManager.
// Основные модули: React, @testing-library/react, EmployeeManager.
import React from 'react';
import { render } from '@testing-library/react';
import EmployeeManager from './EmployeeManager';

describe('EmployeeManager', () => {
  it('рендерит поле имени', () => {
    const { container } = render(<EmployeeManager onSubmit={() => {}} />);
    expect(
      container.querySelector(EmployeeManager.selectors.nameInput),
    ).not.toBeNull();
  });
});
