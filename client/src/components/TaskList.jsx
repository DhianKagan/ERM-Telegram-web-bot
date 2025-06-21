// Отображение списка задач
export default function TaskList({tasks}){
  return(
    <ul className="flex flex-col gap-2">
      {tasks.map(t=>(
        <li key={t._id} className="p-3 bg-white rounded shadow">
          <div className="font-semibold">{t.task_description}</div>
          <div className="text-sm text-gray-500">{t.status} | {t.priority}</div>
        </li>
      ))}
    </ul>
  )
}
