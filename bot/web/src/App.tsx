// Корневой компонент мини‑приложения agrmcs
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
const TaskKanban = lazy(() => import("./pages/TaskKanban"));
const Reports = lazy(() => import("./pages/Reports"));
const LogsPage = lazy(() => import("./pages/Logs"));
const CpIndex = lazy(() => import("./pages/CpIndex"));
const Profile = lazy(() => import("./pages/Profile"));
const MyTasks = lazy(() => import("./pages/MyTasks"));
const CodeLogin = lazy(() => import("./pages/CodeLogin"));
const AttachmentMenu = lazy(() => import("./pages/AttachmentMenu"));
const RoutesPage = lazy(() => import("./pages/Routes"));
const RolesPage = lazy(() => import("./pages/Roles"));
import Sidebar from "./layouts/Sidebar";
import Header from "./layouts/Header";
import { SidebarProvider } from "./context/SidebarContext";
import { useSidebar } from "./context/useSidebar";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthProvider";
import { AuthContext } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { TasksProvider } from "./context/TasksContext";
import Toasts from "./components/Toasts";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import TaskDialogRoute from "./components/TaskDialogRoute";

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
            path="/profile/mytasks"
            element={
              <ProtectedRoute>
                <MyTasks />
              </ProtectedRoute>
            }
          />
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
            path="/tasks/kanban"
            element={
              <ProtectedRoute>
                <TaskKanban />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cp"
            element={
              <AdminRoute>
                <CpIndex />
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
            path="/cp/roles"
            element={
              <AdminRoute>
                <RolesPage />
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
          <Route path="*" element={<Navigate to="/tasks" />} />
        </Routes>
      </Suspense>
    </main>
  );
}

function Layout() {
  const { user } = React.useContext(AuthContext);
  return (
    <>
      {user && <Sidebar />}
      {user && <Header />}
      <Toasts />
      <Content />
      <TaskDialogRoute />
    </>
  );
}

export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <SidebarProvider>
              <TasksProvider>
                <Router>
                  <Layout />
                </Router>
              </TasksProvider>
            </SidebarProvider>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </I18nextProvider>
  );
}
