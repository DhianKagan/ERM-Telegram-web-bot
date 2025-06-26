// Контекст аутентификации, хранит токен и пользователя
import { createContext, useEffect, useState } from 'react'
import { getProfile } from '../services/auth'

export const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(null)
  useEffect(() => {
    if (!token) {
      const params = new URLSearchParams(window.location.search)
      const t = params.get('token')
      if (t) {
        setToken(t)
        localStorage.setItem('token', t)
      }
    }
  }, [])
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
    <AuthContext.Provider value={{ token, user, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
