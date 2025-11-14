// Маршрут только для админа
// Модули: React Router, хук useAuth
import { type ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import Loader from './Loader';

export default function AdminRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'admin') return <Navigate to="/tasks" />;
  return children;
}
