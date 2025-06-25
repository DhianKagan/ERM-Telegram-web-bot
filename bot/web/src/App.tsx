// Корневой компонент мини‑приложения agrmcs
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import TasksPage from "./pages/TasksPage";
import TaskKanban from "./pages/TaskKanban";
import Projects from "./pages/Projects";
import Reports from "./pages/Reports";
import Admin from "./pages/Admin";
import Roles from "./pages/Roles";
import Logs from "./pages/Logs";
import Profile from "./pages/Profile";
import DashboardPage from "./pages/DashboardPage";
import Sidebar from "./layouts/Sidebar";
import Header from "./layouts/Header";
import { SidebarProvider } from "./context/SidebarContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import Toasts from "./components/Toasts";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";

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

              <main className="mt-12 p-4 md:ml-52">
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
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
              </main>
            </Router>

          </SidebarProvider>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
