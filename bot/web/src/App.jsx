// Контейнер приложения с навигацией.
import { Link } from 'react-router-dom'

export default function App({ children }) {
  return (
    <div className="p-4">
      <nav className="mb-4 space-x-4">
        <Link to="/" className="text-blue-500">Задачи</Link>
        <Link to="/admin" className="text-blue-500">Админ</Link>
      </nav>
      {children}
    </div>
  )
}
