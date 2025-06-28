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
const Admin = lazy(() => import("./pages/Admin"));
const Roles = lazy(() => import("./pages/Roles"));
const Logs = lazy(() => import("./pages/Logs"));
const Profile = lazy(() => import("./pages/Profile"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const TelegramLogin = lazy(() => import("./pages/TelegramLogin"));
const AttachmentMenu = lazy(() => import("./pages/AttachmentMenu"));
import Sidebar from "./layouts/Sidebar";
import Header from "./layouts/Header";
import { SidebarProvider, useSidebar } from "./context/SidebarContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import Toasts from "./components/Toasts";
import ProtectedRoute from "./components/ProtectedRoute";

function Content() {
  const { collapsed } = useSidebar();
  return (
    <main className={`mt-12 p-4 ${collapsed ? 'md:ml-20' : 'md:ml-52'}`}>
      <Suspense fallback={<div>Загрузка...</div>}>
        <Routes>
          <Route path="/login" element={<TelegramLogin />} />
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
            path="/roles"
            element={
              <ProtectedRoute>
                <Roles />
              </ProtectedRoute>
            }
          />
          <Route
            path="/logs"
            element={
              <ProtectedRoute>
                <Logs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </Suspense>
    </main>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>

        <ToastProvider>
          <SidebarProvider>
            <Router>
              <Sidebar />
              <Header />
              <Toasts />

              <Content />
            </Router>

          </SidebarProvider>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
