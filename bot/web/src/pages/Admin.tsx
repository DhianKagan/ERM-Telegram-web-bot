// Административная панель управления пользователями
import React from "react"
import AddUserForm from "../components/AddUserForm"
import Breadcrumbs from "../components/Breadcrumbs"
import authFetch from "../utils/authFetch"

interface User { telegram_id: number; username: string }

export default function Admin() {
  const [users, setUsers] = React.useState<User[]>([])
  const load = () => {
    authFetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsers)
  }
  React.useEffect(load, [])
  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Админ" },
        ]}
      />
      <div className="space-y-4 rounded-lg bg-white p-4 shadow-sm dark:bg-boxdark">
        <h2 className="text-xl font-semibold">Админ</h2>
        <AddUserForm onCreate={() => load()} />
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {users.map((u) => (
            <li key={u.telegram_id} className="py-2">
              {u.telegram_id} {u.username}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
