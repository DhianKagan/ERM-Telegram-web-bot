// Назначение файла: таблица задач на основе DataTable
// Основные модули: React, DataTable (лениво), taskColumns, useTasks, coerceTaskId
import React, { lazy, Suspense } from "react";
const DataTable = lazy(() => import("./DataTable"));
import taskColumns, { TaskRow } from "../columns/taskColumns";
import useTasks from "../context/useTasks";
import coerceTaskId from "../utils/coerceTaskId";

type EntityKind = "task" | "request";

interface TaskTableProps {
  tasks: TaskRow[];
  users?: Record<number, any>;
  page: number;
  pageCount?: number;
  mine?: boolean;
  entityKind?: EntityKind;
  onPageChange: (p: number) => void;
  onMineChange?: (v: boolean) => void;
  onRowClick?: (id: string) => void;
  toolbarChildren?: React.ReactNode;
  onDataChange?: (rows: TaskRow[]) => void;
}

export default function TaskTable({
  tasks,
  users = {},
  page,
  pageCount,
  mine = false,
  entityKind = "task",
  onPageChange,
  onMineChange,
  onRowClick,
  toolbarChildren,
  onDataChange,
}: TaskTableProps) {
  const { query, filters } = useTasks();
  const columns = React.useMemo(
    () => taskColumns(users, entityKind),
    [users, entityKind],
  );

  React.useEffect(() => {
    onDataChange?.(tasks);
  }, [onDataChange, tasks]);

  return (
    <Suspense fallback={<div>Загрузка таблицы...</div>}>
      <DataTable<TaskRow>
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
        onRowClick={(row) => {
          const original = row as TaskRow & Record<string, unknown>;
          const normalizedId =
            coerceTaskId(original._id) || coerceTaskId(original.id);
          if (normalizedId) {
            onRowClick?.(normalizedId);
          }
        }}
        toolbarChildren={
          <>
            {typeof onMineChange === "function" && (
              <label
                className="flex items-center gap-1 text-sm"
                htmlFor="task-table-mine"
              >
                <input
                  id="task-table-mine"
                  name="mineTasks"
                  type="checkbox"
                  checked={mine}
                  onChange={(e) => onMineChange(e.target.checked)}
                />
                Мои
              </label>
            )}
            {toolbarChildren}
          </>
        }
      />
    </Suspense>
  );
}
