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
import Profile from "./pages/Profile";
import DashboardPage from "./pages/dashboard/DashboardPage";
import Sidebar from "./layouts/Sidebar";
import Header from "./layouts/Header";
import { SidebarProvider } from "./context/SidebarContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";

export default function App() {
  return (

    <ThemeProvider>
      <SidebarProvider>
        <Router>
          <Sidebar />
          <Header />
          <main className="mt-12 p-4 md:ml-52">
            <Routes>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/tasks/kanban" element={<TaskKanban />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="*" element={<Navigate to="/dashboard" />} />
            </Routes>
          </main>
        </Router>
      </SidebarProvider>
    </ThemeProvider>
  );

    <AuthProvider>
      <ThemeProvider>
        <SidebarProvider>
          <Router>
            <Sidebar />
            <Header />
            <main className="mt-12 p-4 md:ml-52">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                <Route path="/tasks" element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
                <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/dashboard" />} />
              </Routes>
            </main>
          </Router>
        </SidebarProvider>
      </ThemeProvider>
    </AuthProvider>
  )

}
