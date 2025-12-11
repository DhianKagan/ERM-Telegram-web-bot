// Маршрут для менеджера или администратора
// Модули: React Router, хук useAuth
import { type ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { ACCESS_ADMIN, ACCESS_MANAGER, hasAccess } from '../utils/access';
import Loader from './Loader';

export default function ManagerRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" />;
  const access = typeof user.access === 'number' ? user.access : 0;
  const isManager = hasAccess(access, ACCESS_MANAGER);
  const isAdmin = user.role === 'admin' || hasAccess(access, ACCESS_ADMIN);
  if (!isAdmin && !isManager) return <Navigate to="/tasks" />;
  return children;
}
