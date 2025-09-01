// Назначение: страница профиля пользователя
// Основные модули: React, React Router
import { useEffect, useState } from "react";
import { useAuth } from "../context/useAuth";
import Breadcrumbs from "../components/Breadcrumbs";
import { updateProfile } from "../services/auth";

export default function Profile() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState("");
  const [mobNumber, setMobNumber] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name || user.telegram_username || "");
      setMobNumber(user.mobNumber || user.phone || "");
    }
  }, [user]);

  if (!user) return <div>Загрузка...</div>;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Задачи", href: "/tasks" }, { label: "Профиль" }]}
      />
      <div className="mx-auto max-w-xl rounded bg-white p-8 shadow">
        <h2 className="mb-4 text-2xl">Личный кабинет</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">ФИО</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border px-2 py-1"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">Телефон</label>
            <input
              value={mobNumber}
              onChange={(e) => setMobNumber(e.target.value)}
              className="w-full rounded border px-2 py-1"
            />
          </div>
          <button
            type="button"
            onClick={async () => {
              const data = await updateProfile({ name, mobNumber });
              setUser(data);
            }}
            className="btn btn-blue"
          >
            Сохранить
          </button>
          <div>
            <b>Telegram ID:</b> {user.telegram_id}
          </div>
        </div>
      </div>
    </div>
  );
}
