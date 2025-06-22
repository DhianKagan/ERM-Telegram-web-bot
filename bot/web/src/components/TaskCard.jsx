// Карточка задачи в канбане
import React from 'react'

export default function TaskCard({ task }) {
  return (
    <div className="mb-2 rounded bg-white p-3 shadow">
      <h4 className="font-semibold">{task.title}</h4>
      <p className="text-xs text-gray-500">{task.dueDate?.slice(0,10)}</p>
    </div>
  )
}
