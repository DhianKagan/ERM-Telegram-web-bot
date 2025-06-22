// Страница регистрации пользователя
import { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'

export default function Register() {
  const navigate = useNavigate()
  const { register } = useContext(AuthContext)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const submit = async () => {
    await register({ name, email, password: pass })
    navigate('/dashboard')
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl mb-4">Регистрация</h2>
        <input type="text" placeholder="Имя" className="w-full p-2 mb-2 border rounded" value={name} onChange={e=>setName(e.target.value)} />
        <input type="email" placeholder="Email" className="w-full p-2 mb-2 border rounded" value={email} onChange={e=>setEmail(e.target.value)} />
        <input type="password" placeholder="Пароль" className="w-full p-2 mb-4 border rounded" value={pass} onChange={e=>setPass(e.target.value)} />
        <button onClick={submit} className="w-full py-2 bg-green-600 text-white rounded">Зарегистрироваться</button>
        <p className="mt-4 text-center">
          <a href="/login" className="text-blue-600 underline">Уже есть аккаунт?</a>
        </p>
      </div>
    </div>
  )
}
