// Фильтры поиска задач
// Модули: React, shared, useTasks
import React from 'react';
import { TASK_STATUSES, PRIORITIES, TASK_TYPES } from 'shared';
import { Button } from '@/components/ui/button';
import { FormGroup } from '@/components/ui/form-group';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import useTasks from '../context/useTasks';
import type { TaskFilterUser } from '../context/TasksContext';

export type SearchFiltersHandle = {
  apply: () => void;
  reset: () => void;
};

interface Props {
  inline?: boolean;
  showActions?: boolean;
  compact?: boolean;
}

const emptyFilters = {
  status: [],
  priority: [],
  from: '',
  to: '',
  taskTypes: [],
  assignees: [],
};

const SearchFilters = React.forwardRef<SearchFiltersHandle, Props>(
  ({ inline = false, showActions = true, compact = false }, ref) => {
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

    const applyFilters = React.useCallback(() => {
      setFilters(local);
    }, [local, setFilters]);

    const resetFilters = React.useCallback(() => {
      setLocal(emptyFilters);
      setFilters(emptyFilters);
    }, [setFilters]);

    React.useImperativeHandle(ref, () => ({
      apply: applyFilters,
      reset: resetFilters,
    }));

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

    const renderCount = (count: number) =>
      count > 0 ? (
        <span className="rounded bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
          {count}
        </span>
      ) : null;

    const dropdownTriggerClassName =
      'flex items-center gap-2 rounded border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

    const keepOpen = (event: Event) => {
      event.preventDefault();
    };

    const compactContent = (
      <div
        className="flex w-full flex-wrap items-center gap-2 text-xs"
        onKeyDown={handleKeyDown}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={dropdownTriggerClassName}>
              Статус
              {renderCount(local.status.length)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-56">
            <DropdownMenuLabel className="text-xs">Статус</DropdownMenuLabel>
            <div className="max-h-52 overflow-y-auto">
              {TASK_STATUSES.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={local.status.includes(status)}
                  onSelect={keepOpen}
                  onCheckedChange={() => toggleString('status', status)}
                  className="text-xs"
                >
                  {status}
                </DropdownMenuCheckboxItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={dropdownTriggerClassName}>
              Приоритет
              {renderCount(local.priority.length)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-56">
            <DropdownMenuLabel className="text-xs">Приоритет</DropdownMenuLabel>
            <div className="max-h-52 overflow-y-auto">
              {PRIORITIES.map((priority) => (
                <DropdownMenuCheckboxItem
                  key={priority}
                  checked={local.priority.includes(priority)}
                  onSelect={keepOpen}
                  onCheckedChange={() => toggleString('priority', priority)}
                  className="text-xs"
                >
                  {priority}
                </DropdownMenuCheckboxItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={dropdownTriggerClassName}>
              Тип
              {renderCount(local.taskTypes.length)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-56">
            <DropdownMenuLabel className="text-xs">
              Тип задачи
            </DropdownMenuLabel>
            <div className="max-h-52 overflow-y-auto">
              {TASK_TYPES.map((type) => (
                <DropdownMenuCheckboxItem
                  key={type}
                  checked={local.taskTypes.includes(type)}
                  onSelect={keepOpen}
                  onCheckedChange={() => toggleString('taskTypes', type)}
                  className="text-xs"
                >
                  {type}
                </DropdownMenuCheckboxItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={dropdownTriggerClassName}>
              Исполнители
              {renderCount(local.assignees.length)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-72">
            <DropdownMenuLabel className="text-xs">
              Исполнители
            </DropdownMenuLabel>
            <div className="max-h-60 overflow-y-auto">
              {filterUsers.map((user) => (
                <DropdownMenuCheckboxItem
                  key={user.id}
                  checked={local.assignees.includes(user.id)}
                  onSelect={keepOpen}
                  onCheckedChange={() => toggleAssignee(user.id)}
                  className="text-xs"
                >
                  {renderAssigneeLabel(user)}
                </DropdownMenuCheckboxItem>
              ))}
              {filterUsers.length === 0 ? (
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  Нет доступных исполнителей
                </div>
              ) : null}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={dropdownTriggerClassName}>
              Период
              {renderCount(Number(Boolean(local.from || local.to)))}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-64">
            <DropdownMenuLabel className="text-xs">Период</DropdownMenuLabel>
            <div className="space-y-2 px-2 pb-2">
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
          </DropdownMenuContent>
        </DropdownMenu>

        {showActions ? (
          <div className="flex items-center gap-2">
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
        ) : null}
      </div>
    );

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
        {showActions ? (
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
        ) : null}
      </div>
    );

    if (compact) return compactContent;
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
  },
);

SearchFilters.displayName = 'SearchFilters';

export default SearchFilters;
