// Панель управления пользователями
export default function AdminPanel({users}){
  return(
    <div className="p-4">
      <h2 className="font-bold mb-2">Пользователи</h2>
      <ul className="flex flex-col gap-1">
        {users.map(u=>(<li key={u._id} className="flex justify-between">{u.username}<span className="text-gray-500">{u.role}</span></li>))}
      </ul>
    </div>
  )
}
