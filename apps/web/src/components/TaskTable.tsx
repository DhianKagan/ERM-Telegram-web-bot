// Назначение файла: таблица задач на основе DataTable
// Основные модули: React, DataTable (лениво), taskColumns, useTasks
import React, { lazy, Suspense } from "react";
const DataTable = lazy(() => import("./DataTable"));
import taskColumns, { TaskRow } from "../columns/taskColumns";
import useTasks from "../context/useTasks";

interface TaskTableProps {
  tasks: TaskRow[];
  users?: Record<number, any>;
  page: number;
  pageCount?: number;
  onPageChange: (p: number) => void;
  onRowClick?: (id: string) => void;
  toolbarChildren?: React.ReactNode;
}

export default function TaskTable({
  tasks,
  users = {},
  page,
  pageCount,
  onPageChange,
  onRowClick,
  toolbarChildren,
}: TaskTableProps) {
  const { query, filters } = useTasks();
  const columns = React.useMemo(() => taskColumns(users), [users]);

  return (
    <Suspense fallback={<div>Загрузка таблицы...</div>}>
      <DataTable
        columns={columns}
        data={tasks.filter((t) => {
          if (
            query &&
            !JSON.stringify(t).toLowerCase().includes(query.toLowerCase())
          )
            return false;
          if (filters.status.length && !filters.status.includes(t.status))
            return false;
          if (
            filters.priority.length &&
            !filters.priority.includes(t.priority as string)
          )
            return false;
          const created = t.createdAt ? new Date(t.createdAt) : null;
          if (filters.from && created && created < new Date(filters.from))
            return false;
          if (filters.to && created && created > new Date(filters.to))
            return false;
          return true;
        })}
        pageIndex={page}
        pageSize={25}
        pageCount={pageCount}
        onPageChange={onPageChange}
        onRowClick={(row) => onRowClick?.((row as TaskRow)._id)}
        toolbarChildren={toolbarChildren}
      />
    </Suspense>
  );
}
