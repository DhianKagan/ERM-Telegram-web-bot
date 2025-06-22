// Канбан-доска задач
import React, { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import TaskCard from '../components/TaskCard'
import TaskFormModal from '../components/TaskFormModal'
import { fetchKanban, updateTaskStatus } from '../services/tasks'

const columns = ['todo','in_progress','completed']

export default function TaskKanban() {
  const [tasks, setTasks] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => { fetchKanban().then(setTasks) }, [])

  const onDragEnd = async ({ destination, draggableId }) => {
    if (!destination) return
    const status = columns[destination.droppableId]
    await updateTaskStatus(draggableId, status)
    setTasks(ts => ts.map(t => t._id === draggableId ? { ...t, status } : t))
  }

  return (
    <div className="flex space-x-4 p-4">
      <button onClick={() => setOpen(true)} className="btn-blue mb-4">+ Добавить</button>
      <DragDropContext onDragEnd={onDragEnd}>
        {columns.map((key, idx) => (
          <Droppable droppableId={String(idx)} key={key}>
            {provided => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="w-64 rounded bg-gray-100 p-2">
                <h3 className="mb-2 font-bold">{key.replace('_',' ').toUpperCase()}</h3>
                {tasks.filter(t=>t.status===key).map((t,i)=>(
                  <Draggable key={t._id} draggableId={t._id} index={i}>
                    {prov => (
                      <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps}>
                        <TaskCard task={t} />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ))}
      </DragDropContext>
      {open && <TaskFormModal onClose={()=>setOpen(false)} onCreate={()=>{ fetchKanban().then(setTasks) }} />}
    </div>
  )
}
