/** @jest-environment jsdom */
// Назначение файла: проверяет, что AuthProvider передаёт объект контекста и сбрасывает пользователя при logout.
// Основные модули: React, @testing-library/react, AuthProvider, useAuth.
import { render, act } from '@testing-library/react';
import { refresh } from '../services/auth';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';

jest.mock('../services/auth', () => ({
  getProfile: jest.fn().mockResolvedValue(null),
  logout: jest.fn().mockResolvedValue(undefined),
  refresh: jest.fn().mockResolvedValue(undefined),
}));

globalThis.fetch = jest.fn(
  () => Promise.resolve({ json: () => Promise.resolve({}) }) as any,
) as any;

describe('AuthProvider', () => {
  it('возвращает объект контекста', () => {
    let value: any;
    function Child() {
      value = useAuth();
      return null;
    }
    render(
      <AuthProvider>
        <Child />
      </AuthProvider>,
    );
    expect(typeof value).toBe('object');
    expect(value.user).toBeNull();
  });

  it('logout сбрасывает user', async () => {
    let value: any;
    function Child() {
      value = useAuth();
      return null;
    }
    render(
      <AuthProvider>
        <Child />
      </AuthProvider>,
    );
    act(() => {
      value.setUser({ id: '1' } as any);
    });
    expect(value.user).not.toBeNull();
    await act(async () => {
      await value.logout();
    });
    expect(value.user).toBeNull();
  });

  it('запускает один refresh-таймер на провайдер', () => {
    jest.useFakeTimers();
    function Child() {
      useAuth();
      return null;
    }
    render(
      <AuthProvider>
        <Child />
        <Child />
      </AuthProvider>,
    );

    act(() => {
      jest.advanceTimersByTime(4 * 60 * 1000 + 1);
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
