// Назначение файла: таблица задач на основе DataTable
// Основные модули: React, DataTable (лениво), taskColumns, useTasks, coerceTaskId, match-sorter
import React, { lazy, Suspense } from "react";
const DataTable = lazy(() => import("./DataTable"));
import taskColumns, { TaskRow } from "../columns/taskColumns";
import useTasks from "../context/useTasks";
import coerceTaskId from "../utils/coerceTaskId";
import { matchSorter, rankings, type KeyOption } from "match-sorter";

const LazyTaskDataTable = DataTable as React.ComponentType<any>; // Приведение типов: React.lazy скрывает дженерики DataTable

const parseDate = (value: unknown): Date | null => {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    value instanceof Date
  ) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

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

  const searchKeys = React.useMemo<ReadonlyArray<KeyOption<TaskRow>>>(() => {
    const getUserAliases = (
      candidate: number | string | null | undefined,
    ): string => {
      if (typeof candidate === "number" && Number.isFinite(candidate)) {
        const user = users[candidate];
        if (user) {
          const parts = [user.name, user.telegram_username, user.username]
            .filter(
              (value): value is string =>
                typeof value === "string" && value.trim().length > 0,
            )
            .map((value) => value.trim());
          if (parts.length) {
            return Array.from(new Set(parts)).join(" ");
          }
        }
        return String(candidate);
      }
      if (typeof candidate === "string") {
        const trimmed = candidate.trim();
        if (!trimmed) return "";
        const numeric = Number(trimmed);
        if (Number.isFinite(numeric)) {
          const user = users[numeric as number];
          if (user) {
            const parts = [user.name, user.telegram_username, user.username]
              .filter(
                (value): value is string =>
                  typeof value === "string" && value.trim().length > 0,
              )
              .map((value) => value.trim());
            if (parts.length) {
              return Array.from(new Set(parts)).join(" ");
            }
          }
        }
        return trimmed;
      }
      return "";
    };

    const getAssigneeNames = (task: TaskRow): string => {
      const ids = Array.isArray(task.assignees)
        ? task.assignees
        : typeof task.assigned_user_id === "number"
          ? [task.assigned_user_id]
          : [];
      if (!ids.length) return "";
      const labels = ids
        .map((id) => getUserAliases(id))
        .filter((value) => value.length > 0);
      return labels.length ? Array.from(new Set(labels)).join(" ") : "";
    };

    const getCreatorName = (task: TaskRow): string => {
      const source = task as TaskRow & Record<string, unknown>;
      const rawCreator =
        source.created_by ?? source.createdBy ?? source.creator ?? null;
      return getUserAliases(rawCreator as number | string | null | undefined);
    };

    const getGeneralText = (task: TaskRow): string => {
      const values = new Set<string>();
      const push = (value: unknown) => {
        if (value === undefined || value === null) return;
        if (typeof value === "string") {
          const trimmed = value.trim();
          if (trimmed) {
            values.add(trimmed);
          }
          return;
        }
        if (typeof value === "number" && Number.isFinite(value)) {
          values.add(String(value));
        }
      };
      const source = task as TaskRow & Record<string, unknown>;
      push(task.title);
      push(source.task_description);
      push(source.description);
      push(source.task_type);
      push(source.task_category);
      push(source.task_customer);
      push(source.customer);
      push(source.client);
      push(source.client_name);
      push(source.contact);
      push(source.contact_name);
      push(source.address);
      push(source.start_location);
      push(source.end_location);
      push(source.start_address);
      push(source.finish_address);
      push(source.start_phone);
      push(source.finish_phone);
      push(task.task_number);
      push(task.request_id);
      push(task.status);
      push(source.priority);
      const attachments = source.attachments;
      if (Array.isArray(attachments)) {
        attachments.forEach((item) => {
          if (item && typeof item === "object") {
            push((item as Record<string, unknown>).name);
          }
        });
      }
      try {
        values.add(JSON.stringify(task));
      } catch {
        // игнорируем невозможную сериализацию
      }
      return Array.from(values).join(" ");
    };

    return [
      { key: getAssigneeNames, threshold: rankings.CONTAINS },
      { key: getCreatorName, threshold: rankings.CONTAINS },
      { key: getGeneralText, threshold: rankings.CONTAINS },
    ];
  }, [users]);

  const filteredTasks = React.useMemo(() => {
    const normalizedQuery = query.trim();
    const fromDate = filters.from ? new Date(filters.from) : null;
    const toDate = filters.to ? new Date(filters.to) : null;
    const safeFrom = fromDate && Number.isNaN(fromDate.getTime()) ? null : fromDate;
    const safeTo = toDate && Number.isNaN(toDate.getTime()) ? null : toDate;

    const searchResult = normalizedQuery
      ? matchSorter(tasks, normalizedQuery, {
          keys: searchKeys,
          threshold: rankings.CONTAINS,
        })
      : tasks;

    return searchResult.filter((task) => {
      if (filters.status.length && !filters.status.includes(task.status))
        return false;
      if (
        filters.priority.length &&
        !filters.priority.includes(task.priority as string)
      )
        return false;
      const record = task as Record<string, unknown>;
      const created = parseDate(record["createdAt"] ?? record["created_at"]);
      if (safeFrom && created && created < safeFrom) return false;
      if (safeTo && created && created > safeTo) return false;
      return true;
    });
  }, [filters, query, searchKeys, tasks]);

  React.useEffect(() => {
    onDataChange?.(filteredTasks);
  }, [filteredTasks, onDataChange]);

  return (
    <Suspense fallback={<div>Загрузка таблицы...</div>}>
      <LazyTaskDataTable
        columns={columns}
        data={filteredTasks}
        pageIndex={page}
        pageSize={25}
        pageCount={pageCount}
        onPageChange={onPageChange}
        onRowClick={(row: TaskRow) => {
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
