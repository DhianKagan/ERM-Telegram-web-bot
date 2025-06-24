// Страница управления ролями
import React from "react";
import RoleForm from "../components/RoleForm";

interface Role {
  _id: string;
  name: string;
}

export default function Roles() {
  const [roles, setRoles] = React.useState<Role[]>([]);
  const load = () => {
    fetch("/api/roles", {
      headers: {
        Authorization: localStorage.token ? `Bearer ${localStorage.token}` : "",
      },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then(setRoles);
  };
  React.useEffect(load, []);
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Роли</h2>
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <RoleForm onCreate={load} />
      </div>
      <ul className="space-y-2">
        {roles.map((r) => (
          <li
            key={r._id}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
          >
            {r.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
