// Фильтры поиска задач
// Модули: React, shared, useTasks
import React from 'react';
import { TASK_STATUSES, PRIORITIES, TASK_TYPES } from 'shared';
import { Button } from '@/components/ui/button';
import { FormGroup } from '@/components/ui/form-group';
import { Input } from '@/components/ui/input';
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

  const applyFilters = () => {
    setFilters(local);
  };

  const resetFilters = () => {
    setLocal(filters);
    setFilters(filters);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyFilters();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      resetFilters();
    }
  };

  const content = (
    <div
      className="grid w-full min-w-0 grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3"
      onKeyDown={handleKeyDown}
    >
      <FormGroup label="Статус">
        <div className="flex flex-wrap gap-2">
          {TASK_STATUSES.map((s) => {
            const fieldId = toFieldId('status', s);
            return (
              <label
                key={s}
                className="flex items-center gap-2 text-xs"
                htmlFor={fieldId}
              >
                <input
                  id={fieldId}
                  name="status[]"
                  type="checkbox"
                  checked={local.status.includes(s)}
                  onChange={() => toggleString('status', s)}
                  className="size-4"
                />
                <span className="max-w-[14rem] break-words">{s}</span>
              </label>
            );
          })}
        </div>
      </FormGroup>
      <FormGroup label="Приоритет">
        <div className="flex flex-wrap gap-2">
          {PRIORITIES.map((p) => {
            const fieldId = toFieldId('priority', p);
            return (
              <label
                key={p}
                className="flex items-center gap-2 text-xs"
                htmlFor={fieldId}
              >
                <input
                  id={fieldId}
                  name="priority[]"
                  type="checkbox"
                  checked={local.priority.includes(p)}
                  onChange={() => toggleString('priority', p)}
                  className="size-4"
                />
                <span className="max-w-[14rem] break-words">{p}</span>
              </label>
            );
          })}
        </div>
      </FormGroup>
      <FormGroup label="Тип задачи">
        <div className="flex flex-wrap gap-2">
          {TASK_TYPES.map((type) => {
            const fieldId = toFieldId('task-type', type);
            return (
              <label
                key={type}
                className="flex items-center gap-2 text-xs"
                htmlFor={fieldId}
              >
                <input
                  id={fieldId}
                  name="taskTypes[]"
                  type="checkbox"
                  checked={local.taskTypes.includes(type)}
                  onChange={() => toggleString('taskTypes', type)}
                  className="size-4"
                />
                <span className="max-w-[14rem] break-words">{type}</span>
              </label>
            );
          })}
        </div>
      </FormGroup>
      <FormGroup label="Исполнители">
        <div className="max-h-32 space-y-2 overflow-y-auto pr-1">
          {filterUsers.map((user) => {
            const fieldId = toFieldId('assignee', String(user.id));
            return (
              <label
                key={user.id}
                className="flex items-center gap-2 text-xs"
                htmlFor={fieldId}
              >
                <input
                  id={fieldId}
                  name="assignees[]"
                  type="checkbox"
                  checked={local.assignees.includes(user.id)}
                  onChange={() => toggleAssignee(user.id)}
                  className="size-4"
                />
                <span className="max-w-[14rem] break-words">
                  {renderAssigneeLabel(user)}
                </span>
              </label>
            );
          })}
          {filterUsers.length === 0 ? (
            <span className="block text-xs text-muted-foreground">
              Нет доступных исполнителей
            </span>
          ) : null}
        </div>
      </FormGroup>
      <FormGroup label="Период">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="date"
            name="from"
            value={local.from}
            onChange={(e) => setLocal({ ...local, from: e.target.value })}
          />
          <Input
            type="date"
            name="to"
            value={local.to}
            onChange={(e) => setLocal({ ...local, to: e.target.value })}
          />
        </div>
      </FormGroup>
      <div className="flex flex-wrap items-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={applyFilters}
        >
          Искать
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={resetFilters}
        >
          Сбросить
        </Button>
      </div>
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
