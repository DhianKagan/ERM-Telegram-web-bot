// Фильтры поиска задач
// Модули: React, shared, useTasks
import React from 'react';
import { TASK_STATUSES, PRIORITIES, TASK_TYPES } from 'shared';
import useTasks from '../context/useTasks';
import type { TaskFilterUser } from '../context/TasksContext';

interface Props {
  inline?: boolean;
}

export default function SearchFilters({ inline = false }: Props) {
  const { filters, setFilters, filterUsers } = useTasks();
  const [local, setLocal] = React.useState(filters);

  React.useEffect(() => {
    setLocal(filters);
  }, [filters]);

  const toFieldId = React.useCallback(
    (prefix: string, value: string) =>
      `${prefix}-${value}`
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]+/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, ''),
    [],
  );

  const toggleString = (
    key: 'status' | 'priority' | 'taskTypes',
    value: string,
  ) => {
    setLocal((prev) => {
      const arr = prev[key];
      const exists = arr.includes(value);
      const next = exists ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...prev, [key]: next };
    });
  };

  const toggleAssignee = (id: number) => {
    setLocal((prev) => {
      const exists = prev.assignees.includes(id);
      const next = exists
        ? prev.assignees.filter((value) => value !== id)
        : [...prev.assignees, id];
      return { ...prev, assignees: next };
    });
  };

  const renderAssigneeLabel = (user: TaskFilterUser) => {
    if (user.username) {
      return `${user.name} (@${user.username})`;
    }
    return user.name;
  };

  const content = (
    <div className="grid w-full min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-2">
      <div>
        <span className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
          Статус
        </span>
        {TASK_STATUSES.map((s) => {
          const fieldId = toFieldId('status', s);
          return (
            <label
              key={s}
              className="flex items-center gap-1 text-[13px]"
              htmlFor={fieldId}
            >
              <input
                id={fieldId}
                name="status[]"
                type="checkbox"
                checked={local.status.includes(s)}
                onChange={() => toggleString('status', s)}
              />
              {s}
            </label>
          );
        })}
      </div>
      <div>
        <span className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
          Приоритет
        </span>
        {PRIORITIES.map((p) => {
          const fieldId = toFieldId('priority', p);
          return (
            <label
              key={p}
              className="flex items-center gap-1 text-[13px]"
              htmlFor={fieldId}
            >
              <input
                id={fieldId}
                name="priority[]"
                type="checkbox"
                checked={local.priority.includes(p)}
                onChange={() => toggleString('priority', p)}
              />
              {p}
            </label>
          );
        })}
      </div>
      <div>
        <span className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
          Тип задачи
        </span>
        {TASK_TYPES.map((type) => {
          const fieldId = toFieldId('task-type', type);
          return (
            <label
              key={type}
              className="flex items-center gap-1 text-[13px]"
              htmlFor={fieldId}
            >
              <input
                id={fieldId}
                name="taskTypes[]"
                type="checkbox"
                checked={local.taskTypes.includes(type)}
                onChange={() => toggleString('taskTypes', type)}
              />
              {type}
            </label>
          );
        })}
      </div>
      <div>
        <span className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
          Исполнители
        </span>
        <div className="max-h-28 overflow-y-auto pr-1">
          {filterUsers.map((user) => {
            const fieldId = toFieldId('assignee', String(user.id));
            return (
              <label
                key={user.id}
                className="flex items-center gap-1 text-[13px]"
                htmlFor={fieldId}
              >
                <input
                  id={fieldId}
                  name="assignees[]"
                  type="checkbox"
                  checked={local.assignees.includes(user.id)}
                  onChange={() => toggleAssignee(user.id)}
                />
                {renderAssigneeLabel(user)}
              </label>
            );
          })}
          {filterUsers.length === 0 ? (
            <span className="block text-[13px] text-muted-foreground">
              Нет доступных исполнителей
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          className="w-full rounded border px-1.5 py-1 text-[13px]"
          name="from"
          value={local.from}
          onChange={(e) => setLocal({ ...local, from: e.target.value })}
        />
        <input
          type="date"
          className="w-full rounded border px-1.5 py-1 text-[13px]"
          name="to"
          value={local.to}
          onChange={(e) => setLocal({ ...local, to: e.target.value })}
        />
      </div>
      <button
        onClick={() => setFilters(local)}
        className="mt-1.5 rounded border px-1.5 py-1 text-[13px]"
      >
        Искать
      </button>
    </div>
  );

  if (inline) return content;

  return (
    <details className="relative">
      <summary className="cursor-pointer rounded border px-1.5 py-0.5 select-none text-sm">
        Фильтры
      </summary>
      <div className="absolute z-10 mt-1 rounded border bg-white p-1.5 shadow">
        {content}
      </div>
    </details>
  );
}
