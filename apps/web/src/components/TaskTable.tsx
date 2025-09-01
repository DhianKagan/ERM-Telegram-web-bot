// Назначение файла: таблица задач на основе DataTable
// Основные модули: React, DataTable (лениво), taskColumns, useTasks
import React, { lazy, Suspense } from "react";
const DataTable = lazy(() => import("./DataTable"));
import taskColumns, { TaskRow } from "../columns/taskColumns";
import useTasks from "../context/useTasks";

interface TaskTableProps {
  tasks: TaskRow[];
  users?: Record<number, any>;
  onSelectionChange?: (ids: string[]) => void;
  page: number;
  pageCount?: number;
  onPageChange: (p: number) => void;
  onRowClick?: (id: string) => void;
}

export default function TaskTable({
  tasks,
  users = {},
  onSelectionChange,
  page,
  pageCount,
  onPageChange,
  onRowClick,
}: TaskTableProps) {
  const { query } = useTasks();
  const columns = React.useMemo(() => taskColumns(true, users), [users]);

  return (
    <Suspense fallback={<div>Загрузка таблицы...</div>}>
      <DataTable
        columns={columns}
        data={tasks.filter((t) =>
          query
            ? JSON.stringify(t).toLowerCase().includes(query.toLowerCase())
            : true,
        )}
        pageIndex={page}
        pageSize={25}
        pageCount={pageCount}
        onPageChange={onPageChange}
        onSelectionChange={(rows) =>
          onSelectionChange?.((rows as TaskRow[]).map((r) => r._id))
        }
        onRowClick={(row) => onRowClick?.((row as TaskRow)._id)}
      />
    </Suspense>
  );
}
