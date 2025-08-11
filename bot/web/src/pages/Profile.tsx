// Назначение: страница профиля пользователя, модули: React, React Router
import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import Tabs from "../components/Tabs";
import Breadcrumbs from "../components/Breadcrumbs";
import { fetchTasks } from "../services/tasks";
import { updateProfile } from "../services/auth";
import SkeletonCard from "../components/SkeletonCard";
import Pagination from "../components/Pagination";
import userLink from "../utils/userLink";

interface TaskItem {
  _id: string;
  title: string;
  status: string;
  priority?: string;
  start_date?: string;
  due_date?: string;
  request_id: string;
  createdAt: string;
  assignees?: number[];
  assigned_user_id?: number;
}

interface UserInfo {
  telegram_id: number;
  username: string;
  name?: string;
  telegram_username?: string;
  phone?: string;
}

export default function Profile() {
  const { user, setUser } = useContext(AuthContext);
  const [tab, setTab] = useState("details");
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [userMap, setUserMap] = useState<Record<number, UserInfo>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const perPage = 10;
  const [name, setName] = useState("");
  const [mobNumber, setMobNumber] = useState("");
  useEffect(() => {
    if (tab === "tasks" && user && tasks.length === 0) {
      setLoading(true);
      fetchTasks()
        .then((d: any) => {
          setTasks(d.tasks || []);
          const list: UserInfo[] = Array.isArray(d.users)
            ? d.users
            : Object.values(d.users || {});
          const map: Record<number, UserInfo> = {};
          list.forEach((u) => {
            map[u.telegram_id] = u;
          });
          setUserMap(map);
        })
        .finally(() => setLoading(false));
    }
  }, [tab, user, tasks.length]);
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
              (() => {
                const myTasks = tasks.filter((t) =>
                  (
                    t.assignees ||
                    (t.assigned_user_id ? [t.assigned_user_id] : [])
                  ).includes(user.telegram_id),
                );
                const sorted = [...myTasks];
                sorted.sort((a, b) => {
                  const v1 = a[sortBy as keyof TaskItem];
                  const v2 = b[sortBy as keyof TaskItem];
                  if (v1 === undefined) return 1;
                  if (v2 === undefined) return -1;
                  if (v1 > v2) return sortDir === "asc" ? 1 : -1;
                  if (v1 < v2) return sortDir === "asc" ? -1 : 1;
                  return 0;
                });
                const total = Math.ceil(sorted.length / perPage);
                const handleSort = (col: string) => {
                  if (sortBy === col) {
                    setSortDir(sortDir === "asc" ? "desc" : "asc");
                  } else {
                    setSortBy(col);
                    setSortDir("asc");
                  }
                };
                return (
                  <>
                    <table className="min-w-full divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white text-sm shadow-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th
                            className="cursor-pointer px-4 py-2 text-left"
                            onClick={() => handleSort("title")}
                          >
                            Название{" "}
                            {sortBy === "title"
                              ? sortDir === "asc"
                                ? "▲"
                                : "▼"
                              : ""}
                          </th>
                          <th
                            className="cursor-pointer px-4 py-2"
                            onClick={() => handleSort("status")}
                          >
                            Статус{" "}
                            {sortBy === "status"
                              ? sortDir === "asc"
                                ? "▲"
                                : "▼"
                              : ""}
                          </th>
                          <th
                            className="cursor-pointer px-4 py-2"
                            onClick={() => handleSort("priority")}
                          >
                            Приоритет{" "}
                            {sortBy === "priority"
                              ? sortDir === "asc"
                                ? "▲"
                                : "▼"
                              : ""}
                          </th>
                          <th
                            className="cursor-pointer px-4 py-2"
                            onClick={() => handleSort("start_date")}
                          >
                            Дата начала{" "}
                            {sortBy === "start_date"
                              ? sortDir === "asc"
                                ? "▲"
                                : "▼"
                              : ""}
                          </th>
                          <th
                            className="cursor-pointer px-4 py-2"
                            onClick={() => handleSort("due_date")}
                          >
                            Дедлайн{" "}
                            {sortBy === "due_date"
                              ? sortDir === "asc"
                                ? "▲"
                                : "▼"
                              : ""}
                          </th>
                          <th
                            className="cursor-pointer px-4 py-2"
                            onClick={() => handleSort("assignees")}
                          >
                            Исполнители{" "}
                            {sortBy === "assignees"
                              ? sortDir === "asc"
                                ? "▲"
                                : "▼"
                              : ""}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {sorted
                          .slice((page - 1) * perPage, page * perPage)
                          .map((t) => (
                            <tr key={t._id}>
                              <td className="px-4 py-2">
                                {`${t.request_id} ${t.createdAt.slice(0, 10)} ${t.title.replace(/^ERM_\d+\s*/, "")}`}
                              </td>
                              <td className="px-4 py-2 text-center">
                                {t.status}
                              </td>
                              <td className="px-4 py-2 text-center">
                                {t.priority}
                              </td>
                              <td className="px-4 py-2 text-center">
                                {t.start_date?.slice(0, 10)}
                              </td>
                              <td className="px-4 py-2 text-center">
                                {t.due_date?.slice(0, 10)}
                              </td>
                              <td className="px-4 py-2">
                                {(
                                  t.assignees ||
                                  (t.assigned_user_id
                                    ? [t.assigned_user_id]
                                    : [])
                                ).map((id) => (
                                  <span
                                    key={id}
                                    dangerouslySetInnerHTML={{
                                      __html: userLink(
                                        id,
                                        userMap[id]?.name ||
                                          userMap[id]?.telegram_username ||
                                          userMap[id]?.username,
                                      ),
                                    }}
                                    className="mr-1"
                                  />
                                ))}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {total > 1 && (
                      <Pagination
                        total={total}
                        page={page}
                        onChange={setPage}
                      />
                    )}
                  </>
                );
              })()
            )}
          </div>
        )}
      </div>
    </div>
  );
}
