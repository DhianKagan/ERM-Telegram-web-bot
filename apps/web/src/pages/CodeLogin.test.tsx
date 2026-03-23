/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import CodeLogin from './CodeLogin';

const addToastMock = jest.fn();
const setUserMock = jest.fn();
const navigateMock = jest.fn();
const authFetchMock = jest.fn();
const getProfileMock = jest.fn();
const refreshMock = jest.fn();
const setAccessTokenMock = jest.fn();
const shouldUseBearerAuthMock = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => navigateMock,
}));

jest.mock('../context/useToast', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

jest.mock('../context/useAuth', () => ({
  useAuth: () => ({ setUser: setUserMock }),
}));

jest.mock('../utils/authFetch', () => ({
  __esModule: true,
  default: (...args: unknown[]) => authFetchMock(...args),
}));

jest.mock('../services/auth', () => ({
  getProfile: (...args: unknown[]) => getProfileMock(...args),
  refresh: (...args: unknown[]) => refreshMock(...args),
}));

jest.mock('../lib/auth', () => ({
  setAccessToken: (...args: unknown[]) => setAccessTokenMock(...args),
  shouldUseBearerAuth: (...args: unknown[]) => shouldUseBearerAuthMock(...args),
}));

describe('CodeLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    shouldUseBearerAuthMock.mockReturnValue(false);
    authFetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ token: 'legacy-token' }),
    });
    getProfileMock.mockResolvedValue({ id: '1', username: 'service_account' });
    refreshMock.mockResolvedValue(undefined);
  });

  it('для сервисного аккаунта повторяет refresh/profile, если профиль недоступен сразу после успешного входа', async () => {
    getProfileMock
      .mockRejectedValueOnce(new Error('unauthorized'))
      .mockResolvedValueOnce({ id: '1', username: 'service_account' });

    render(
      <MemoryRouter>
        <CodeLogin />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Сервисный аккаунт' }));
    fireEvent.change(screen.getByLabelText('Логин'), {
      target: { value: 'service_account' },
    });
    fireEvent.change(screen.getByLabelText('Пароль'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => {
      expect(authFetchMock).toHaveBeenCalledWith(
        '/api/v1/auth/login_password',
        expect.objectContaining({ method: 'POST', noRedirect: true }),
      );
    });

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1);
      expect(getProfileMock).toHaveBeenCalledTimes(2);
      expect(setUserMock).toHaveBeenCalledWith({
        id: '1',
        username: 'service_account',
      });
      expect(navigateMock).toHaveBeenCalledWith('/requests', { replace: true });
    });

    expect(addToastMock).not.toHaveBeenCalledWith(
      'Сессия создана, но профиль пока недоступен. Повторите вход.',
      'error',
    );
    expect(setAccessTokenMock).toHaveBeenCalledWith('legacy-token');
  });
});
