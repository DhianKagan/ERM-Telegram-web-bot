/** @jest-environment jsdom */
// Назначение файла: тесты маршрутов ProtectedRoute и AdminRoute на индикатор загрузки.
// Основные модули: React, @testing-library/react.
import '@testing-library/jest-dom';
import React from 'react';
import { render } from '@testing-library/react';
import ProtectedRoute from '../apps/web/src/components/ProtectedRoute';
import AdminRoute from '../apps/web/src/components/AdminRoute';
import { AuthContext } from '../apps/web/src/context/AuthContext';

const value = {
  user: null,
  loading: true,
  logout: jest.fn(),
  setUser: jest.fn(),
};

test('ProtectedRoute показывает индикатор при загрузке', () => {
  const { getByTestId } = render(
    <AuthContext.Provider value={value}>
      <ProtectedRoute>
        <div>child</div>
      </ProtectedRoute>
    </AuthContext.Provider>,
  );
  expect(getByTestId('loader')).toBeInTheDocument();
});

test('AdminRoute показывает индикатор при загрузке', () => {
  const { getByTestId } = render(
    <AuthContext.Provider value={value}>
      <AdminRoute>
        <div>child</div>
      </AdminRoute>
    </AuthContext.Provider>,
  );
  expect(getByTestId('loader')).toBeInTheDocument();
});
