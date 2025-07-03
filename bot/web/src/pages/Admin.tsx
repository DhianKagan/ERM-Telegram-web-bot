// Административная панель управления пользователями
import React from "react"
import AddUserForm from "../components/AddUserForm"
import AddDepartmentForm from "../components/AddDepartmentForm"
import Breadcrumbs from "../components/Breadcrumbs"
import authFetch from "../utils/authFetch"
import { AuthContext } from "../context/AuthContext"

interface Role { _id: string; name: string }
interface User {
  telegram_id: number
  username: string
  verified_at?: string
  roleId?: Role
}
interface Department { _id: string; name: string }

export default function Admin() {
  const [users, setUsers] = React.useState<User[]>([])
  const [departments, setDepartments] = React.useState<Department[]>([])
  const { user } = React.useContext(AuthContext)
  const load = () => {
    authFetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsers)
    authFetch('/api/departments')
      .then(r=>r.ok?r.json():[])
      .then(setDepartments)
  }
  React.useEffect(() => {
    if (user?.roleId?.name === 'admin') load()
  }, [user])
  if (user?.roleId?.name !== 'admin') return <div className="p-4">Доступ запрещен</div>
  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Админ" },
        ]}
      />
      <div className="space-y-4 rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-xl font-semibold">Админ</h2>
        <AddUserForm onCreate={() => load()} />
        <AddDepartmentForm onCreate={() => load()} />
        <ul className="divide-y divide-gray-200">
          {users.map((u) => (
            <li key={u.telegram_id} className="py-2">
              <a
                href={`tg://user?id=${u.telegram_id}`}
                className="text-accentPrimary hover:underline"
              >
                {u.name || u.username}
              </a>
              {u.roleId ? ` (${u.roleId.name})` : ""}
              {u.verified_at ? ' ✅' : ' ❌'}
            </li>
          ))}
        </ul>
        <ul className="divide-y divide-gray-200">
          {departments.map(d => (
            <li key={d._id} className="py-2">{d.name}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
