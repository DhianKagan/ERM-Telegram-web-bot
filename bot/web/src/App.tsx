// Корневой компонент мини‑приложения agrmcs
import React, { Suspense, lazy } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
const TasksPage = lazy(() => import("./pages/TasksPage"));
const TaskKanban = lazy(() => import("./pages/TaskKanban"));
const Projects = lazy(() => import("./pages/Projects"));
const Reports = lazy(() => import("./pages/Reports"));
const AdminPage = lazy(() => import("./pages/Admin"));
const Profile = lazy(() => import("./pages/Profile"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const CodeLogin = lazy(() => import("./pages/CodeLogin"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AttachmentMenu = lazy(() => import("./pages/AttachmentMenu"));
const RoutesPage = lazy(() => import("./pages/Routes"));
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
import TaskDialogRoute from "./components/TaskDialogRoute";

function Content() {
  const { collapsed, open } = useSidebar();
  return (
    <main className={`mt-14 p-4 transition-all ${open ? (collapsed ? 'md:ml-20' : 'md:ml-60') : 'md:ml-0'}`}>
      <Suspense fallback={<div>Загрузка...</div>}>
        <Routes>
          <Route path="/login" element={<CodeLogin />} />
          <Route path="/admin/login" element={<AdminLogin />} />
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
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
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
            path="/projects"
            element={
              <ProtectedRoute>
                <Projects />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/routes"
            element={
              <ProtectedRoute>
                <RoutesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </Suspense>
    </main>
  );
}

function Layout() {
  const { token } = React.useContext(AuthContext);
  return (
    <>
      {token && <Sidebar />}
      {token && <Header />}
      <Toasts />
      <Content />
      <TaskDialogRoute />
    </>
  );
}

export default function App() {
  return (
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
  );
}
