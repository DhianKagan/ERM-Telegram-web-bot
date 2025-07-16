// Маршрут только для админа
import { useContext, type ReactElement } from 'react'
import { Navigate } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import parseJwt from '../utils/parseJwt'

export default function AdminRoute({ children }: { children: ReactElement }) {
  const { token } = useContext(AuthContext)
  if (!token) return <Navigate to="/login" />
  const data = parseJwt(token)
  if (data?.role !== 'admin') return <Navigate to="/tasks" />
  return children
}
