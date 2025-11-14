// Назначение: вспомогательный хук для открытия и закрытия карточки сотрудника в модалке.
// Основные модули: React Router.
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function useEmployeeDialog() {
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname, search } = location;

  const open = useCallback(
    (id: number | string) => {
      const params = new URLSearchParams(search);
      params.set('employee', String(id));
      const query = params.toString();
      navigate(
        { pathname, search: query ? `?${query}` : undefined },
        { replace: false },
      );
    },
    [navigate, pathname, search],
  );

  const close = useCallback(() => {
    const params = new URLSearchParams(search);
    params.delete('employee');
    const query = params.toString();
    navigate(
      { pathname, search: query ? `?${query}` : undefined },
      { replace: true },
    );
  }, [navigate, pathname, search]);

  return { open, close };
}
