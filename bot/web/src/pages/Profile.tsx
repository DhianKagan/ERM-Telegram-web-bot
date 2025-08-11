// Назначение: страница профиля пользователя, модули: React, React Router
import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import Tabs from "../components/Tabs";
import Breadcrumbs from "../components/Breadcrumbs";
import { fetchTasks } from "../services/tasks";
import { updateProfile } from "../services/auth";
import SkeletonCard from "../components/SkeletonCard";
import Pagination from "../components/Pagination";

interface TaskItem {
  _id: string;
  task_description: string;
}

export default function Profile() {
  const { user, setUser } = useContext(AuthContext);
  const [tab, setTab] = useState("details");
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [name, setName] = useState("");
  const [mobNumber, setMobNumber] = useState("");
  useEffect(() => {
    fetchTasks().then((d: any) => {
      setTasks(d.tasks || []);
      setLoading(false);
    });
  }, []);
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
        <Tabs
          options={[
            { key: "details", label: "Детали" },
            { key: "tasks", label: "Мои задачи" },
          ]}
          active={tab}
          onChange={setTab}
        />
        {tab === "details" ? (
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
        ) : (
          <div className="space-y-4">
            {loading ? (
              <SkeletonCard />
            ) : (
              <>
                <ul className="space-y-2">
                  {tasks
                    .slice((page - 1) * perPage, page * perPage)
                    .map((t) => (
                      <li
                        key={t._id}
                        className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
                      >
                        {t.task_description}
                      </li>
                    ))}
                </ul>
                {Math.ceil(tasks.length / perPage) > 1 && (
                  <Pagination
                    total={Math.ceil(tasks.length / perPage)}
                    page={page}
                    onChange={setPage}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
