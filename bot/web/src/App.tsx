// Корневой компонент мини‑приложения agrmcs
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Tasks from "./pages/Tasks";
import Logs from "./pages/Logs";
import Roles from "./pages/Roles";
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
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/roles" element={<Roles />} />
              <Route path="*" element={<Navigate to="/dashboard" />} />
            </Routes>
          </main>
        </Router>
      </SidebarProvider>
    </ThemeProvider>
  );
}
