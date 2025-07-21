// Назначение: защита маршрута, модули: React, React Router
import { useContext, type ReactNode } from "react";
import { AuthContext } from "../context/AuthContext";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user } = useContext(AuthContext);
  return user ? children : <Navigate to="/login" />;
}
