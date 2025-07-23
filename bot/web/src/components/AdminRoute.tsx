// Маршрут только для админа
import { useContext, type ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function AdminRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useContext(AuthContext);
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== "admin") return <Navigate to="/tasks" />;
  return children;
}
