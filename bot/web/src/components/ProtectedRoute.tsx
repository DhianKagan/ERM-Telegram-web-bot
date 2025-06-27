import { useContext, type ReactNode } from 'react'
import { AuthContext } from '../context/AuthContext'

interface ProtectedRouteProps {
  children: ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { token } = useContext(AuthContext)
  return token ? children : <div className="p-4">Откройте приложение через Telegram</div>
}
