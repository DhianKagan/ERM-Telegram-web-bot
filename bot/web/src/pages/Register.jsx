// Страница регистрации пользователя
import { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import Spinner from '../components/Spinner'
import { useToast } from '../context/ToastContext'

export default function Register() {
  const navigate = useNavigate()
  const { register } = useContext(AuthContext)
  const { addToast } = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async () => {
    setLoading(true)
    try {
      await register({ name, email, password: pass })
      addToast('Регистрация успешна')
      navigate('/dashboard')
    } catch {
      addToast('Ошибка регистрации', 'error')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow dark:bg-boxdark">
        <h2 className="mb-4 text-2xl font-semibold">Регистрация</h2>
        <input
          type="text"
          placeholder="Имя"
          className="mb-2 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring focus:ring-brand-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
          {loading ? <Spinner /> : 'Зарегистрироваться'}
        </button>
        <p className="mt-4 text-center">
          <a href="/login" className="text-primary hover:underline">Уже есть аккаунт?</a>
        </p>
      </div>
    </div>
  )
}
