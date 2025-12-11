// Маршрут только для админа
// Модули: React Router, хук useAuth
import { type ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { ACCESS_ADMIN, hasAccess } from '../utils/access';
import Loader from './Loader';

export default function AdminRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" />;
  const access = typeof user.access === 'number' ? user.access : 0;
  if (user.role !== 'admin' && !hasAccess(access, ACCESS_ADMIN))
    return <Navigate to="/tasks" />;
  return children;
}
