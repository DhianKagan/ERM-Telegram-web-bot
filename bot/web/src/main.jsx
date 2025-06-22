// Основной вход приложения React с маршрутизацией.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import App from './App'
import Tasks from './pages/Tasks'
import Admin from './pages/Admin'
import './index.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App>
        <Routes>
          <Route path="/" element={<Tasks />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </App>
    </BrowserRouter>
  </React.StrictMode>
)
