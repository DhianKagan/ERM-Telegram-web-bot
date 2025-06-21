// Отображение списка задач с фильтрацией и выбором
export default function TaskList({ tasks, filter = '', onSelect }) {
  const shown = tasks.filter(t =>
    t.task_description.toLowerCase().includes(filter.toLowerCase())
  )
  return (
    <ul className="flex flex-col gap-2">
      {shown.map(t => (
        <li
          key={t._id}
          onClick={() => onSelect && onSelect(t)}
          className="p-3 bg-white rounded shadow hover:bg-blue-50 cursor-pointer"
        >
          <div className="font-semibold">{t.task_description}</div>
          <div className="text-sm text-gray-500">
            {t.status} | {t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}
          </div>
        </li>
      ))}
    </ul>
  )
}
