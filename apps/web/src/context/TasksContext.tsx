// Провайдер контекста задач и глобального поиска
import React, { useState } from "react";
import { TasksContext } from "./TasksContext";

export const TasksProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const refresh = () => setVersion((v) => v + 1);
  return (
    <TasksContext.Provider value={{ version, refresh, query, setQuery }}>
      {children}
    </TasksContext.Provider>
  );
};
