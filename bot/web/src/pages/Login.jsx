// Страница входа пользователя
import { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import Spinner from '../components/Spinner'
import { useToast } from '../context/ToastContext'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useContext(AuthContext)
  const { addToast } = useToast()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async () => {
    setLoading(true)
    try {
      await login({ email, password: pass })
      addToast('Вход выполнен')
      navigate('/dashboard')
    } catch {
      addToast('Ошибка входа', 'error')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow dark:bg-boxdark">
        <h2 className="mb-4 text-2xl font-semibold">Войти</h2>
        <input
          type="email"
          placeholder="Email"
          className="mb-2 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring focus:ring-brand-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Пароль"
          className="mb-4 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring focus:ring-brand-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />
        <button onClick={submit} className="btn btn-blue flex w-full items-center justify-center">
          {loading ? <Spinner /> : 'Войти'}
        </button>
        <p className="mt-4 text-center">
          <a href="/register" className="text-primary hover:underline">Регистрация</a>
        </p>
      </div>
    </div>
  )
}
