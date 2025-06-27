// Форма создания роли
import React from "react";
import authFetch from "../utils/authFetch";

interface RoleFormProps {
  onCreate?: (data: unknown) => void
}

export default function RoleForm({ onCreate }: RoleFormProps) {
  const [name, setName] = React.useState("");
  const submit = async (e) => {
    e.preventDefault();
    const res = await authFetch("/api/roles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      onCreate && onCreate(await res.json());
      setName("");
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Название роли"
        className="focus:border-accentPrimary focus:ring-brand-200 flex-grow rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder-gray-500 focus:ring dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        required
      />
      <button
        type="submit"
        className="bg-accentPrimary hover:bg-accentSecondary rounded-md px-4 py-2 text-sm font-medium text-white"
      >
        Создать
      </button>
    </form>
  );
}
