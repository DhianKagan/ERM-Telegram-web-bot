// Страница управления ролями
import React from 'react'
import RoleForm from '../components/RoleForm'

interface Role { _id: string; name: string }

export default function Roles() {
  const [roles, setRoles] = React.useState<Role[]>([])
  const load = () => {
    fetch('/api/roles', { headers:{ Authorization: localStorage.token ? `Bearer ${localStorage.token}` : '' } })
      .then(r=>r.ok?r.json():[]).then(setRoles)
  }
  React.useEffect(load, [])
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Роли</h2>
      <RoleForm onCreate={load} />
      <ul className="space-y-1">
        {roles.map(r=> (
          <li key={r._id} className="rounded border p-2">{r.name}</li>
        ))}
      </ul>
    </div>
  )
}
