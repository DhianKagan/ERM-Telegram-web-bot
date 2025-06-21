// Хук авторизации, хранит JWT и роль
import { useState, useEffect } from 'react'
import { login } from '../api/api'
export const useAuth = () => {
  const [user, setUser] = useState(null)
  const token = localStorage.getItem('token')
  useEffect(()=>{ if(token && !user) setUser({ token }) }, [])
  const signIn = async (email,password)=>{
    const {data}=await login({email,password});
    localStorage.setItem('token', data.token)
    setUser({ token:data.token, role:data.role, name:data.name })
  }
  const signOut=()=>{localStorage.removeItem('token');setUser(null)}
  return { user, signIn, signOut }
}
