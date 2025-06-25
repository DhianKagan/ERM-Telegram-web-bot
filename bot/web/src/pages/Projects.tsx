// Страница управления проектами (группами задач)
import React from "react"
import GroupForm from "../components/GroupForm"
import Breadcrumbs from "../components/Breadcrumbs"

interface Group { _id: string; name: string }

export default function Projects() {
  const [groups, setGroups] = React.useState<Group[]>([])
  const load = () => {
    fetch("/api/groups", {
      headers: {
        Authorization: localStorage.token ? `Bearer ${localStorage.token}` : "",
      },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then(setGroups)
  }
  React.useEffect(load, [])
  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Проекты" },
        ]}
      />
      <div className="space-y-4 rounded-lg bg-white p-4 shadow-sm dark:bg-boxdark">
        <h2 className="text-xl font-semibold">Проекты</h2>
        <GroupForm onCreate={load} />
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {groups.map((g) => (
            <li key={g._id} className="py-2">
              {g.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
