// Хук для доступа к TasksContext
import { useContext } from "react";
import { TasksContext } from "./TasksContext";

export default function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasks используется вне TasksProvider");
  return ctx;
}
