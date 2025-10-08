// Маршрут архива для админов с правами 6+
// Модули: React Router, useAuth, utils/access
import { type ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import Loader from "./Loader";
import { ARCHIVE_ACCESS, hasAccess } from "../utils/access";

export default function ArchiveRoute({
  children,
}: {
  children: ReactElement;
}) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" />;
  const access = typeof user.access === "number" ? user.access : 0;
  if (user.role !== "admin" || !hasAccess(access, ARCHIVE_ACCESS)) {
    return <Navigate to="/tasks" />;
  }
  return children;
}
