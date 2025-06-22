// Главный компонент панели задач
import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Tasks from "./pages/Tasks";
import Logs from "./pages/Logs";
import Roles from "./pages/Roles";

export default function App() {
  return (
    <Router>
      <div className="gradient-bg min-h-screen space-y-4 p-4">
        <h1 className="text-2xl font-bold">Админ-панель</h1>
        <nav className="space-x-4">
          <Link to="/tasks">Задачи</Link>
          <Link to="/logs">Логи</Link>
          <Link to="/roles">Роли</Link>
        </nav>
        <Routes>
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/roles" element={<Roles />} />
          <Route path="*" element={<p>Добро пожаловать!</p>} />
        </Routes>
      </div>
    </Router>
  );
}
