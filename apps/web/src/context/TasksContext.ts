// Контекст задач, глобального поиска и фильтров
import { createContext } from "react";
import type { TaskStateController } from "../controllers/taskStateController";

// Фильтры поиска задач
export interface TaskFilters {
  status: string[];
  priority: string[];
  from: string;
  to: string;
}

export interface TasksState {
  version: number;
  refresh: () => void;
  query: string;
  setQuery: (q: string) => void;
  filters: TaskFilters;
  setFilters: (f: TaskFilters) => void;
  controller: TaskStateController;
}

export const TasksContext = createContext<TasksState | undefined>(undefined);

// Экспорт провайдера
export { TasksProvider } from "./TasksProvider";
