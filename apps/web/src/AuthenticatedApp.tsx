// Назначение файла: оболочка авторизованной части приложения и маршрутизация после входа.
// Основные модули: React, React Router, контексты приложения.
import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Sidebar from "./layouts/Sidebar";
import Header from "./layouts/Header";
import { SidebarProvider } from "./context/SidebarContext";
import { useSidebar } from "./context/useSidebar";
import { TasksProvider } from "./context/TasksContext";
import { useAuth } from "./context/useAuth";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import ManagerRoute from "./components/ManagerRoute";
import TaskDialogRoute from "./components/TaskDialogRoute";
import EmployeeDialogRoute from "./components/EmployeeDialogRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import ArchiveRoute from "./components/ArchiveRoute";

const TasksPage = lazy(() => import("./pages/TasksPage"));
const Reports = lazy(() => import("./pages/Reports"));
const LogsPage = lazy(() => import("./pages/Logs"));
const Profile = lazy(() => import("./pages/Profile"));
const TaskKanban = lazy(() => import("./pages/TaskKanban"));
const RoutesPage = lazy(() => import("./pages/Routes"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const ThemeSettings = lazy(() => import("./pages/ThemeSettings"));
const StoragePage = lazy(() => import("./pages/Storage"));
const ArchivePage = lazy(() => import("./pages/Archive"));
const ThemeProviderLazy = lazy(async () => {
  const mod = await import("./context/ThemeProvider");
  return { default: mod.ThemeProvider };
});

function AppShell() {
  const { user } = useAuth();
  const { open, toggle } = useSidebar();
  const { t } = useTranslation();
  const contentOffsetClass = open ? "lg:pl-64" : "lg:pl-0";
  return (
    <>
      {user && <Sidebar />}
      {user && open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          tabIndex={-1}
          ref={(el) => el?.focus()}
          onClick={() => {
            (document.activeElement as HTMLElement | null)?.blur();
            toggle();
          }}
        />
      )}
      <div
        className={`flex min-h-screen flex-col bg-slate-50/40 transition-[padding] duration-200 ease-out dark:bg-slate-900/40 ${contentOffsetClass}`}
      >
        {user && <Header />}
        <main className="flex-1 p-4 pt-3 transition-all lg:pt-4">
          <Suspense fallback={<div>{t("loading")}</div>}>
            <Routes>
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tasks"
                element={
                  <ProtectedRoute>
                    <TasksPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/mg/kanban"
                element={
                  <ManagerRoute>
                    <TaskKanban />
                  </ManagerRoute>
                }
              />
              <Route
                path="/mg/reports"
                element={
                  <ManagerRoute>
                    <Reports />
                  </ManagerRoute>
                }
              />
              <Route
                path="/mg/routes"
                element={
                  <ManagerRoute>
                    <RoutesPage />
                  </ManagerRoute>
                }
              />
              <Route
                path="/cp/kanban"
                element={
                  <AdminRoute>
                    <TaskKanban />
                  </AdminRoute>
                }
              />
              <Route
                path="/cp/reports"
                element={
                  <AdminRoute>
                    <Reports />
                  </AdminRoute>
                }
              />
              <Route
                path="/cp/routes"
                element={
                  <AdminRoute>
                    <RoutesPage />
                  </AdminRoute>
                }
              />
              <Route
                path="/cp/settings"
                element={
                  <AdminRoute>
                    <SettingsPage />
                  </AdminRoute>
                }
              />
              <Route
                path="/cp/logs"
                element={
                  <AdminRoute>
                    <LogsPage />
                  </AdminRoute>
                }
              />
              <Route
                path="/cp/storage"
                element={
                  <AdminRoute>
                    <StoragePage />
                  </AdminRoute>
                }
              />
              <Route
                path="/cp/archive"
                element={
                  <ArchiveRoute>
                    <ArchivePage />
                  </ArchiveRoute>
                }
              />
              <Route
                path="/theme"
                element={
                  <ProtectedRoute>
                    <ThemeSettings />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/tasks" />} />
            </Routes>
          </Suspense>
        </main>
      </div>
      <TaskDialogRoute />
      <EmployeeDialogRoute />
    </>
  );
}

export default function AuthenticatedApp({
  alert,
}: {
  alert: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <ThemeProviderLazy>
        <Suspense fallback={null}>
          <ErrorBoundary fallback={<div>Произошла ошибка</div>}>
            <SidebarProvider>
              <TasksProvider>
                <AppShell />
              </TasksProvider>
            </SidebarProvider>
            {alert}
          </ErrorBoundary>
        </Suspense>
      </ThemeProviderLazy>
    </Suspense>
  );
}
