// Контекст аутентификации, хранит токен и пользователя
import { createContext, useEffect, useState } from 'react'
import { login as apiLogin, register as apiRegister, getProfile } from '../services/auth'

export const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(null)
  useEffect(() => {
    if (token) getProfile(token).then(setUser).catch(() => setToken(null))
  }, [token])
  const login = async creds => {
    const { token: t } = await apiLogin(creds)
    if (t) { setToken(t); localStorage.setItem('token', t) }
  }
  const register = async data => {
    await apiRegister(data)
    await login({ email: data.email, password: data.password })
  }
  const logout = () => { setToken(null); setUser(null); localStorage.removeItem('token') }
  return (
    <AuthContext.Provider value={{ token, user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
