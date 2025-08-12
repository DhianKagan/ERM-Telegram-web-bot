// Назначение: страница "Мои задачи" пользователя; модули: React, контексты, сервис задач
import { useContext, useEffect, useState } from "react";
import Breadcrumbs from "../components/Breadcrumbs";
import SkeletonCard from "../components/SkeletonCard";
import Pagination from "../components/Pagination";
import { fetchTasks } from "../services/tasks";
import { AuthContext } from "../context/AuthContext";
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
  created_by?: number;
}

interface UserInfo {
  telegram_id: number;
  username: string;
  name?: string;
  telegram_username?: string;
  phone?: string;
}

export default function MyTasks() {
  const { user } = useContext(AuthContext);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [userMap, setUserMap] = useState<Record<number, UserInfo>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [view, setView] = useState<"assigned" | "created">("assigned");
  const perPage = 10;

  useEffect(() => {
    setLoading(true);
    fetchTasks()
      .then((d: any) => {
        const raw = Array.isArray(d) ? d : d.items || d.tasks || d.data || [];
        const listTasks = raw.map((t: any) => ({
          id: t._id ?? t.id,
          _id: t._id ?? t.id,
          ...t,
        }));
        console.log("rows", listTasks.length, listTasks[0]);
        setTasks(listTasks);
        const list: UserInfo[] = Array.isArray(d?.users)
          ? d.users
          : Object.values(d?.users || {});
        const map: Record<number, UserInfo> = {};
        list.forEach((u) => {
          map[u.telegram_id] = u;
        });
        setUserMap(map);
      })
      .finally(() => setLoading(false));
  }, []);

  if (!user) return <div>Загрузка...</div>;

  const myTasks = tasks.filter((t) => {
    const assigned =
      t.assignees || (t.assigned_user_id ? [t.assigned_user_id] : []);
    return view === "assigned"
      ? assigned.includes(user.telegram_id)
      : t.created_by === user.telegram_id;
  });

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
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Профиль", href: "/profile" },
          { label: "Мои задачи" },
        ]}
      />
      {loading ? (
        <SkeletonCard />
      ) : (
        <>
          <div className="flex space-x-2">
            <button
              onClick={() => setView("assigned")}
              className={`rounded border px-2 py-1 ${
                view === "assigned" ? "bg-accentPrimary text-white" : ""
              }`}
            >
              Назначенные мне
            </button>
            <button
              onClick={() => setView("created")}
              className={`rounded border px-2 py-1 ${
                view === "created" ? "bg-accentPrimary text-white" : ""
              }`}
            >
              Созданные мной
            </button>
          </div>
          <table className="min-w-full divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white text-sm shadow-sm">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="cursor-pointer px-4 py-2 text-left"
                  onClick={() => handleSort("title")}
                >
                  Название{" "}
                  {sortBy === "title" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </th>
                <th
                  className="cursor-pointer px-4 py-2"
                  onClick={() => handleSort("status")}
                >
                  Статус{" "}
                  {sortBy === "status" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </th>
                <th
                  className="cursor-pointer px-4 py-2"
                  onClick={() => handleSort("priority")}
                >
                  Приоритет{" "}
                  {sortBy === "priority" ? (sortDir === "asc" ? "▲" : "▼") : ""}
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
                  {sortBy === "due_date" ? (sortDir === "asc" ? "▲" : "▼") : ""}
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
              {sorted.slice((page - 1) * perPage, page * perPage).map((t) => (
                <tr key={t._id}>
                  <td className="px-4 py-2">
                    {`${t.request_id} ${t.createdAt.slice(0, 10)} ${t.title.replace(/^ERM_\d+\s*/, "")}`}
                  </td>
                  <td className="px-4 py-2 text-center">{t.status}</td>
                  <td className="px-4 py-2 text-center">{t.priority}</td>
                  <td className="px-4 py-2 text-center">
                    {t.start_date?.slice(0, 10)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {t.due_date?.slice(0, 10)}
                  </td>
                  <td className="px-4 py-2">
                    {(
                      t.assignees ||
                      (t.assigned_user_id ? [t.assigned_user_id] : [])
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
            <Pagination total={total} page={page} onChange={setPage} />
          )}
        </>
      )}
    </div>
  );
}
