import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { token } = useContext(AuthContext)
  return token ? children : <div className="p-4">Откройте приложение через Telegram</div>
}
