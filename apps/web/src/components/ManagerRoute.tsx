// Маршрут для менеджера или администратора
// Модули: React Router, хук useAuth
import { type ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import Loader from './Loader';

export default function ManagerRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'admin' && user.role !== 'manager')
    return <Navigate to="/tasks" />;
  return children;
}
