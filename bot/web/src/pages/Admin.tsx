// Административная панель управления пользователями
import React from "react"
import AddUserForm from "../components/AddUserForm"

interface User { telegram_id: number; username: string }

export default function Admin() {
  const [users, setUsers] = React.useState<User[]>([])
  const load = () => {
    fetch("/api/users", { headers:{ Authorization: localStorage.token ? `Bearer ${localStorage.token}` : "" } })
      .then(r=>r.ok?r.json():[]).then(setUsers)
  }
  React.useEffect(load, [])
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Админ</h2>
      <AddUserForm onCreate={()=>load()} />
      <ul className="space-y-1">
        {users.map(u=> (
          <li key={u.telegram_id} className="rounded border p-2">{u.telegram_id} {u.username}</li>
        ))}
      </ul>
    </div>
  )
}
