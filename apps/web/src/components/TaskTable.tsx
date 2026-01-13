// Назначение файла: таблица задач на основе SimpleTable
// Основные модули: React, SimpleTable, taskColumns, useTasks, coerceTaskId
import React from 'react';
import { EyeIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import taskColumns, { TaskRow } from '../columns/taskColumns';
import { SimpleTable } from '@/components/ui/simple-table';
import type { User as AppUser } from '../types/user';
import useTasks from '../context/useTasks';
import coerceTaskId from '../utils/coerceTaskId';
import matchTaskQuery from '../utils/matchTaskQuery';

type EntityKind = 'task' | 'request';

interface TaskTableProps {
  tasks: TaskRow[];
  users?: Record<number, AppUser>;
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
  users,
  page,
  pageCount,
  mine = false,
  entityKind = 'task',
  onPageChange,
  onMineChange,
  onRowClick,
  toolbarChildren,
  onDataChange,
}: TaskTableProps) {
  const { query, filters } = useTasks();
  const userMap = React.useMemo<Record<number, AppUser>>(
    () => users ?? {},
    [users],
  );
  const columns = React.useMemo(
    () => taskColumns(userMap, entityKind),
    [userMap, entityKind],
  );

  React.useEffect(() => {
    onDataChange?.(tasks);
  }, [onDataChange, tasks]);

  const filtered = tasks.filter((t) => {
    if (query && !matchTaskQuery(t, query, userMap)) return false;
    if (filters.status.length && !filters.status.includes(t.status))
      return false;
    if (
      filters.priority.length &&
      !filters.priority.includes(t.priority as string)
    )
      return false;
    if (filters.taskTypes.length) {
      const taskType =
        typeof (t as Record<string, unknown>).task_type === 'string'
          ? ((t as Record<string, unknown>).task_type as string).trim()
          : '';
      if (!taskType || !filters.taskTypes.includes(taskType)) return false;
    }
    if (filters.assignees.length) {
      const assigned = new Set<number>();
      const collect = (value: unknown) => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          assigned.add(value);
        } else if (typeof value === 'string') {
          const parsed = Number(value.trim());
          if (Number.isFinite(parsed)) assigned.add(parsed);
        }
      };
      if (Array.isArray((t as Record<string, unknown>).assignees)) {
        ((t as Record<string, unknown>).assignees as unknown[]).forEach(
          collect,
        );
      }
      collect((t as Record<string, unknown>).assigned_user_id);
      if (
        !filters.assignees.some((assignee) => assigned.has(Number(assignee)))
      ) {
        return false;
      }
    }
    const created = t.createdAt ? new Date(t.createdAt) : null;
    if (filters.from && created && created < new Date(filters.from))
      return false;
    if (filters.to && created && created > new Date(filters.to)) return false;
    return true;
  });

  const resolveRowId = React.useCallback((row: TaskRow) => {
    const original = row as TaskRow & Record<string, unknown>;
    return coerceTaskId(original._id) || coerceTaskId(original.id);
  }, []);

  return (
    <SimpleTable<TaskRow>
      columns={columns}
      data={filtered}
      pageIndex={page}
      pageSize={25}
      pageCount={pageCount}
      onPageChange={onPageChange}
      onRowClick={(row) => {
        const normalizedId = resolveRowId(row);
        if (normalizedId) {
          onRowClick?.(normalizedId);
        }
      }}
      showGlobalSearch={false}
      showFilters={false}
      toolbarChildren={toolbarChildren}
      getRowActions={(row) => {
        const normalizedId = resolveRowId(row);
        if (!normalizedId || !onRowClick) return [];
        return [
          {
            label: 'Открыть',
            icon: <EyeIcon className="size-4" />,
            onClick: () => onRowClick(normalizedId),
            variant: 'outline',
          },
          {
            label: 'Редактировать',
            icon: <PencilSquareIcon className="size-4" />,
            onClick: () => onRowClick(normalizedId),
            variant: 'secondary',
          },
        ];
      }}
    />
  );
}
