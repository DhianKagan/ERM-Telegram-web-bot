// Провайдер контекста задач, поиска и фильтров
import React, { useState } from 'react';
import { taskStateController } from '../controllers/taskStateController';
import {
  TasksContext,
  type TaskFilters,
  type TaskFilterUser,
} from './TasksContext';

export const TasksProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<TaskFilters>({
    status: [],
    priority: [],
    from: '',
    to: '',
    taskTypes: [],
    assignees: [],
  });
  const [filterUsers, setFilterUsers] = useState<TaskFilterUser[]>([]);
  const refresh = () => setVersion((v) => v + 1);
  return (
    <TasksContext.Provider
      value={{
        version,
        refresh,
        query,
        setQuery,
        filters,
        setFilters,
        filterUsers,
        setFilterUsers,
        controller: taskStateController,
      }}
    >
      {children}
    </TasksContext.Provider>
  );
};
