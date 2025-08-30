// Назначение: защита маршрута, модули: React Router и хук useAuth
import { type ReactNode } from "react";
import { useAuth } from "../context/useAuth";
import { Navigate } from "react-router-dom";
import Loader from "./Loader";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  return user ? children : <Navigate to="/login" />;
}
