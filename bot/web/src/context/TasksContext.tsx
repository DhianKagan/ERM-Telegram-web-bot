// Провайдер контекста задач, увеличивает версию для перезагрузки
import React, { useState } from 'react'
import { TasksContext } from './TasksContext'

export const TasksProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [version, setVersion] = useState(0)
  const refresh = () => setVersion(v => v + 1)
  return (
    <TasksContext.Provider value={{ version, refresh }}>
      {children}
    </TasksContext.Provider>
  )
}
