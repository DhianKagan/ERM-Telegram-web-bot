// Контекст аутентификации, хранит токен и пользователя
import { createContext, useEffect, useState, type ReactNode } from 'react'
import { getProfile } from '../services/auth'

interface AuthContextType {
  token: string | null
  user: Record<string, unknown> | null
  logout: () => void
  setUser: (u: Record<string, unknown> | null) => void
}

export const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  logout: () => {},
  setUser: () => {}
})

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [user, setUser] = useState<Record<string, unknown> | null>(null)
  useEffect(() => {
    if (!token) {
      const params = new URLSearchParams(window.location.search)
      const t = params.get('token')
      if (t) {
        setToken(t)
        localStorage.setItem('token', t)
      }
    }
  }, [token])
  useEffect(() => {
    if (token) getProfile(token)
      .then(setUser)
      .catch(() => {
        setToken(null)
        localStorage.removeItem('token')
      })
  }, [token])
  const logout = () => { setToken(null); setUser(null); localStorage.removeItem('token') }
  return (
    <AuthContext.Provider value={{ token, user, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}
