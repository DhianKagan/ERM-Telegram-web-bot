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
  return (
    <main className={`mt-14 p-4 transition-all ${open ? (collapsed ? 'md:ml-20' : 'md:ml-60') : 'md:ml-0'}`}>
      <Suspense fallback={<div>Загрузка...</div>}>
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
            path="/cp/projects"
            element={
              <AdminRoute>
                <Projects />
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
            path="/cp/admin"
            element={
              <AdminRoute>
                <AdminPage />
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
