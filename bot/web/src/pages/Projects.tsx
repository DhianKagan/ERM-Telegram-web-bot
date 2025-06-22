// Страница управления проектами (группами задач)
import React from "react"
import GroupForm from "../components/GroupForm"

interface Group { _id: string; name: string }

export default function Projects() {
  const [groups, setGroups] = React.useState<Group[]>([])
  const load = () => {
    fetch("/api/groups", { headers:{ Authorization: localStorage.token ? `Bearer ${localStorage.token}` : "" } })
      .then(r=>r.ok?r.json():[]).then(setGroups)
  }
  React.useEffect(load, [])
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Проекты</h2>
      <GroupForm onCreate={load} />
      <ul className="space-y-1">
        {groups.map(g=> (
          <li key={g._id} className="rounded border p-2">{g.name}</li>
        ))}
      </ul>
    </div>
  )
}
