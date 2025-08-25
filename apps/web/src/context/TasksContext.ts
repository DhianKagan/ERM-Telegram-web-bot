// Контекст задач и глобального поиска
import { createContext } from "react";

export interface TasksState {
  version: number;
  refresh: () => void;
  query: string;
  setQuery: (q: string) => void;
}

export const TasksContext = createContext<TasksState | undefined>(undefined);

// Экспорт провайдера
export { TasksProvider } from "./TasksContext.tsx";
