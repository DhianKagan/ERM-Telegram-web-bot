import { createContext, useEffect, useState } from 'react'
import { getProfile } from '../services/auth'

export const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(null)
  useEffect(() => {
    if (token) getProfile(token).then(setUser).catch(() => setToken(null))
  }, [token])
  return (
    <AuthContext.Provider value={{ token, user, setToken }}>
      {children}
    </AuthContext.Provider>
  )
}
