// Страница настройки прав ролей
import React, { useEffect, useState } from 'react'
import Breadcrumbs from '../components/Breadcrumbs'
import { fetchRoles, updateRole } from '../services/roles'

interface Role {
  _id: string
  name: string
  permissions?: string[]
}

const perms = ['tasks', 'routes', 'admin']

export default function Roles() {
  const [roles, setRoles] = useState<Role[]>([])
  const load = () => fetchRoles().then(setRoles)
  useEffect(load, [])

  const toggle = async (id: string, p: string) => {
    const role = roles.find(r => r._id === id)
    if (!role) return
    const arr = role.permissions || []
    const exists = arr.includes(p)
    const updated = exists ? arr.filter(x => x !== p) : [...arr, p]
    await updateRole(id, updated)
    load()
  }

  return (
    <div className="space-y-4 p-4">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Роли' }]} />
      {roles.map(r => (
        <div key={r._id} className="rounded border p-4 space-y-2">
          <h3 className="font-semibold">{r.name}</h3>
          <div className="flex gap-4">
            {perms.map(p => (
              <label key={p} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={r.permissions?.includes(p)}
                  onChange={() => toggle(r._id, p)}
                />
                {p}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
