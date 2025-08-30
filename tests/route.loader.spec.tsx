/** @jest-environment jsdom */
// Назначение файла: тесты маршрутов ProtectedRoute и AdminRoute на индикатор загрузки.
// Основные модули: React, @testing-library/react.
import '@testing-library/jest-dom';
import React from 'react';
import { render } from '@testing-library/react';
import ProtectedRoute from '../apps/web/src/components/ProtectedRoute';
import AdminRoute from '../apps/web/src/components/AdminRoute';
import { AuthContext } from '../apps/web/src/context/AuthContext';
import { AuthActionsContext } from '../apps/web/src/context/AuthActionsContext';

const state = { user: null, loading: true };
const actions = {
  logout: jest.fn().mockResolvedValue(undefined),
  setUser: jest.fn(),
};

test('ProtectedRoute показывает индикатор при загрузке', () => {
  const { getByTestId } = render(
    <AuthContext.Provider value={state}>
      <AuthActionsContext.Provider value={actions}>
        <ProtectedRoute>
          <div>child</div>
        </ProtectedRoute>
      </AuthActionsContext.Provider>
    </AuthContext.Provider>,
  );
  expect(getByTestId('loader')).toBeInTheDocument();
});

test('AdminRoute показывает индикатор при загрузке', () => {
  const { getByTestId } = render(
    <AuthContext.Provider value={state}>
      <AuthActionsContext.Provider value={actions}>
        <AdminRoute>
          <div>child</div>
        </AdminRoute>
      </AuthActionsContext.Provider>
    </AuthContext.Provider>,
  );
  expect(getByTestId('loader')).toBeInTheDocument();
});
