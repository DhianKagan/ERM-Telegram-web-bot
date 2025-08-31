/** @jest-environment jsdom */
// Назначение файла: проверяет вывод запасного UI в ErrorBoundary при исключении.
// Основные модули: React, @testing-library/react.
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../apps/web/src/components/ErrorBoundary';

describe('ErrorBoundary', () => {
  it('отображает fallback при ошибке', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const Problem: React.FC = () => {
      throw new Error('boom');
    };
    render(
      <ErrorBoundary fallback={<div role="alert">Ошибка</div>}>
        <React.StrictMode>
          <Problem />
        </React.StrictMode>
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Ошибка');
    spy.mockRestore();
  });
});
