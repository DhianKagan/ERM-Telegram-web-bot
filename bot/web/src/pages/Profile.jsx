import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'

export default function Profile() {
  const { user } = useContext(AuthContext)
  if (!user) return <div>Загрузка...</div>
  return (
    <div className="p-8 max-w-xl mx-auto bg-white rounded shadow">
      <h2 className="text-2xl mb-4">Личный кабинет</h2>
      <p><b>Имя:</b> {user.name}</p>
      <p><b>Email:</b> {user.email}</p>
      <p><b>Роль:</b> {user.role}</p>
    </div>
  )
}
