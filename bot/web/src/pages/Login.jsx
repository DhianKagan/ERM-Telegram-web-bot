import { useState, useContext } from 'react'
import { login } from '../services/auth'
import { AuthContext } from '../context/AuthContext'

export default function Login() {
  const { setToken } = useContext(AuthContext)
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const submit = async () => {
    const { token } = await login({ email, password: pass })
    if (token) { setToken(token); localStorage.setItem('token', token) }
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl mb-4">Войти</h2>
        <input type="email" placeholder="Email" className="w-full p-2 mb-2 border rounded" value={email} onChange={e=>setEmail(e.target.value)} />
        <input type="password" placeholder="Пароль" className="w-full p-2 mb-4 border rounded" value={pass} onChange={e=>setPass(e.target.value)} />
        <button onClick={submit} className="w-full py-2 bg-blue-600 text-white rounded">Войти</button>
        <p className="mt-4 text-center">
          <a href="/register" className="text-blue-600 underline">Регистрация</a>
        </p>
      </div>
    </div>
  )
}
