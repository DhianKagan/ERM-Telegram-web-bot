// Корневой компонент мини‑приложения ERM
import React, { Suspense, lazy } from "react";
import { useTranslation, I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
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
import { AuthProvider } from "./context/AuthProvider";
import { useAuth } from "./context/useAuth";
import { TasksProvider } from "./context/TasksContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import ManagerRoute from "./components/ManagerRoute";
import TaskDialogRoute from "./components/TaskDialogRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import AlertDialog from "./components/AlertDialog";

const ThemeProviderLazy = lazy(async () => {
  const mod = await import("./context/ThemeProvider");
  return { default: mod.ThemeProvider };
});

const ToastProviderLazy = lazy(async () => {
  const mod = await import("./context/ToastProvider");
  return { default: mod.ToastProvider };
});

const ToastsLazy = lazy(() => import("./components/Toasts"));

function AppShell() {
  const { user } = useAuth();
  const { collapsed, open, toggle } = useSidebar();
  const { t } = useTranslation();
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
      <main
        className={`mt-14 p-4 transition-all ${open ? (collapsed ? "md:ml-20" : "md:ml-60") : "md:ml-0"}`}
      >
        <Suspense fallback={<div>{t("loading")}</div>}>
          <Routes>
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
      <TaskDialogRoute />
    </>
  );
}

function LoginLayout() {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm space-y-4 rounded border bg-white p-6 shadow">
        <Suspense fallback={<div>{t("loading")}</div>}>
          <CodeLogin />
        </Suspense>
      </div>
    </main>
  );
}

function AuthenticatedArea({ alert }: { alert: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ThemeProviderLazy>
        <Suspense fallback={null}>
          <ToastProviderLazy>
            <ErrorBoundary fallback={<div>Произошла ошибка</div>}>
              <Suspense fallback={null}>
                <ToastsLazy />
              </Suspense>
              <AuthProvider>
                <SidebarProvider>
                  <TasksProvider>
                    <AppShell />
                  </TasksProvider>
                </SidebarProvider>
              </AuthProvider>
              {alert}
            </ErrorBoundary>
          </ToastProviderLazy>
        </Suspense>
      </ThemeProviderLazy>
    </Suspense>
  );
}

function AppContent({
  initialAlert,
  onCloseAlert,
}: {
  initialAlert: string | null;
  onCloseAlert: () => void;
}) {
  const location = useLocation();
  const alert = (
    <AlertDialog
      open={!!initialAlert}
      message={initialAlert || ""}
      onClose={onCloseAlert}
      closeText={i18n.t("close")}
    />
  );
  if (location.pathname.startsWith("/login")) {
    return (
      <>
        <ErrorBoundary fallback={<div>Произошла ошибка</div>}>
          <LoginLayout />
        </ErrorBoundary>
        {alert}
      </>
    );
  }
  return <AuthenticatedArea alert={alert} />;
}

export default function App() {
  const [initialAlert, setInitialAlert] = React.useState<string | null>(
    typeof window !== "undefined"
      ? (window as any).__ALERT_MESSAGE__ || null
      : null,
  );
  return (
    <I18nextProvider i18n={i18n}>
      <Router>
        <AppContent
          initialAlert={initialAlert}
          onCloseAlert={() => setInitialAlert(null)}
        />
      </Router>
    </I18nextProvider>
  );
}
