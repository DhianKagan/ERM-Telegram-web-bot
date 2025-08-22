// Контекст обновления списка задач
import { createContext } from "react";

export interface TasksState {
  version: number;
  refresh: () => void;
}

export const TasksContext = createContext<TasksState | undefined>(undefined);

// Экспорт провайдера
export { TasksProvider } from "./TasksContext.tsx";
