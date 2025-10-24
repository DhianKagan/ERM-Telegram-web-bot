// Контекст задач, глобального поиска и фильтров
import { createContext } from "react";
import type { TaskStateController } from "../controllers/taskStateController";

// Фильтры поиска задач
export interface TaskFilters {
  status: string[];
  priority: string[];
  from: string;
  to: string;
  taskTypes: string[];
  assignees: number[];
}

export interface TaskFilterUser {
  id: number;
  name: string;
  username?: string | null;
}

export interface TasksState {
  version: number;
  refresh: () => void;
  query: string;
  setQuery: (q: string) => void;
  filters: TaskFilters;
  setFilters: (f: TaskFilters) => void;
  controller: TaskStateController;
  filterUsers: TaskFilterUser[];
  setFilterUsers: (users: TaskFilterUser[]) => void;
}

export const TasksContext = createContext<TasksState | undefined>(undefined);

// Экспорт провайдера
export { TasksProvider } from "./TasksProvider";
