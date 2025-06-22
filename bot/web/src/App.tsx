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
}
