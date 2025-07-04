// Страница списка универсальных заявок
import React from "react";
import { listUniversalTasks, deleteUniversalTask } from "../services/universalTasks";
import UniversalTaskForm from "../components/UniversalTaskForm";
import { useToast } from "../context/ToastContext";

interface Task {
  _id: string;
  request_id: string;
  status: string;
  priority: string;
}

export default function UniversalTasks() {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [open, setOpen] = React.useState(false);
  const { addToast } = useToast();

  const load = React.useCallback(() => {
    listUniversalTasks().then(setTasks);
  }, []);

  React.useEffect(load, [load]);

  const remove = async (id: string) => {
    await deleteUniversalTask(id);
    addToast("Заявка удалена");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2 className="text-xl font-semibold">Универсальные заявки</h2>
        <button onClick={() => setOpen(true)} className="btn-blue">Новая</button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">ID</th>
              <th className="px-4 py-2">Приоритет</th>
              <th className="px-4 py-2">Статус</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {tasks.map((t) => (
              <tr key={t._id}>
                <td className="px-4 py-2">{t.request_id}</td>
                <td className="px-4 py-2 text-center">{t.priority}</td>
                <td className="px-4 py-2 text-center">{t.status}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => remove(t._id)} className="text-danger text-xs hover:underline">
                    удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <UniversalTaskForm
          onClose={() => setOpen(false)}
          onCreate={() => {
            setOpen(false);
            addToast("Заявка создана");
            load();
          }}
        />
      )}
    </div>
  );
}
