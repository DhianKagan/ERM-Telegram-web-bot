// Хук доступа к данным и действиям аутентификации
import { useContext, useEffect } from 'react';
import { AuthContext } from './AuthContext';
import { AuthActionsContext } from './AuthActionsContext';
import { refresh } from '../services/auth';

export function useAuth() {
  const state = useContext(AuthContext);
  const actions = useContext(AuthActionsContext);
  useEffect(() => {
    const id = setInterval(
      () => {
        refresh().catch(() => actions.logout());
      },
      4 * 60 * 1000,
    );
    return () => clearInterval(id);
  }, [actions]);
  return { ...state, ...actions };
}
