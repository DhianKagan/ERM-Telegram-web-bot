// Корневой компонент мини‑приложения ERM
import React, { Suspense, lazy } from "react";
import { useTranslation, I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
const TasksPage = lazy(() => import("./pages/TasksPage"));
const Reports = lazy(() => import("./pages/Reports"));
const LogsPage = lazy(() => import("./pages/Logs"));
const Profile = lazy(() => import("./pages/Profile"));
const TaskKanban = lazy(() => import("./pages/TaskKanban"));
const CodeLogin = lazy(() => import("./pages/CodeLogin"));
const AttachmentMenu = lazy(() => import("./pages/AttachmentMenu"));
const RoutesPage = lazy(() => import("./pages/Routes"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const ThemeSettings = lazy(() => import("./pages/ThemeSettings"));
const StoragePage = lazy(() => import("./pages/Storage"));
const EmployeeCard = lazy(() => import("./pages/EmployeeCard"));
import Sidebar from "./layouts/Sidebar";
import Header from "./layouts/Header";
import { SidebarProvider } from "./context/SidebarContext";
import { useSidebar } from "./context/useSidebar";
import { ThemeProvider } from "./context/ThemeProvider";
import { AuthProvider } from "./context/AuthProvider";
import { useAuth } from "./context/useAuth";
import { ToastProvider } from "./context/ToastContext";
import { TasksProvider } from "./context/TasksContext";
import Toasts from "./components/Toasts";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import ManagerRoute from "./components/ManagerRoute";
import TaskDialogRoute from "./components/TaskDialogRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import AlertDialog from "./components/AlertDialog";

function Content() {
  const { collapsed, open } = useSidebar();
  const { t } = useTranslation();
  return (
    <main
      className={`mt-14 p-4 transition-all ${open ? (collapsed ? "md:ml-20" : "md:ml-60") : "md:ml-0"}`}
    >
      <Suspense fallback={<div>{t("loading")}</div>}>
        <Routes>
          <Route path="/login" element={<CodeLogin />} />
          <Route path="/menu" element={<AttachmentMenu />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employees/:id"
            element={
              <ProtectedRoute>
                <EmployeeCard />
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
  );
}

function Layout() {
  const { user } = useAuth();
  const { open, toggle } = useSidebar();
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
      {user && <Header />}
      <Toasts />
      <Content />
      <TaskDialogRoute />
    </>
  );
}

export default function App() {
  const [initialAlert, setInitialAlert] = React.useState<string | null>(
    typeof window !== "undefined"
      ? (window as any).__ALERT_MESSAGE__ || null
      : null,
  );
  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <SidebarProvider>
              <TasksProvider>
                <ErrorBoundary fallback={<div>Произошла ошибка</div>}>
                  <Router>
                    <Layout />
                  </Router>
                  <AlertDialog
                    open={!!initialAlert}
                    message={initialAlert || ""}
                    onClose={() => setInitialAlert(null)}
                    closeText={i18n.t("close")}
                  />
                </ErrorBoundary>
              </TasksProvider>
            </SidebarProvider>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </I18nextProvider>
  );
}
