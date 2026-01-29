// Диалог создания и редактирования маршрутных листов
// Основные модули: React, routePlans, ui/dialog
import React from 'react';
import type { RoutePlan, Task } from 'shared';

import { Button } from '@/components/ui/button';
import { FormGroup } from '@/components/ui/form-group';
import { Input } from '@/components/ui/input';
import SingleSelect, {
  type SingleSelectOption,
} from '@/components/SingleSelect';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  createRoutePlan,
  getRoutePlan,
  updateRoutePlan,
  type RoutePlanCreatePayload,
} from '../services/routePlans';
import { fetchUsers } from '../services/users';
import {
  fetchAllCollectionObjects,
  type CollectionObject,
} from '../services/collections';
import {
  fetchTasks,
  fetchTransportOptions,
  type TransportVehicleOption,
} from '../services/tasks';
import type { User } from '../types/user';

type RoutePlanDialogProps = {
  open: boolean;
  planId?: string | null;
  onClose: () => void;
  onSaved: (plan: RoutePlan) => void;
};

const parseUserId = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizePayload = (
  title: string,
  notes: string,
  creatorId: string | null,
  executorId: string | null,
  companyPointIds: string[],
  transportId: string | null,
  transportName: string | null,
  taskIds: string[],
): RoutePlanCreatePayload => {
  const trimmedTitle = title.trim();
  const trimmedNotes = notes.trim();
  return {
    ...(trimmedTitle ? { title: trimmedTitle } : {}),
    notes: trimmedNotes ? trimmedNotes : null,
    creatorId: parseUserId(creatorId),
    executorId: parseUserId(executorId),
    companyPointIds,
    transportId: transportId || null,
    transportName: transportName || null,
    tasks: taskIds,
  };
};

export default function RoutePlanDialog({
  open,
  planId,
  onClose,
  onSaved,
}: RoutePlanDialogProps) {
  const [title, setTitle] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [creatorId, setCreatorId] = React.useState<string | null>(null);
  const [executorId, setExecutorId] = React.useState<string | null>(null);
  const [companyPointIds, setCompanyPointIds] = React.useState<string[]>([]);
  const [transportId, setTransportId] = React.useState<string | null>(null);
  const [transportName, setTransportName] = React.useState<string | null>(null);
  const [taskIds, setTaskIds] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [users, setUsers] = React.useState<User[]>([]);
  const [usersLoading, setUsersLoading] = React.useState(false);
  const [usersError, setUsersError] = React.useState<string | null>(null);
  const [collectionObjects, setCollectionObjects] = React.useState<
    CollectionObject[]
  >([]);
  const [collectionsLoading, setCollectionsLoading] = React.useState(false);
  const [collectionsError, setCollectionsError] = React.useState<string | null>(
    null,
  );
  const [transportOptions, setTransportOptions] = React.useState<
    TransportVehicleOption[]
  >([]);
  const [transportLoading, setTransportLoading] = React.useState(false);
  const [transportError, setTransportError] = React.useState<string | null>(
    null,
  );
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = React.useState(false);
  const [tasksError, setTasksError] = React.useState<string | null>(null);

  const isEdit = Boolean(planId);

  React.useEffect(() => {
    if (!open) {
      setTitle('');
      setNotes('');
      setCreatorId(null);
      setExecutorId(null);
      setCompanyPointIds([]);
      setTransportId(null);
      setTransportName(null);
      setTaskIds([]);
      setLoading(false);
      setSaving(false);
      setError(null);
      return;
    }
    if (!planId) {
      setTitle('');
      setNotes('');
      setCreatorId(null);
      setExecutorId(null);
      setCompanyPointIds([]);
      setTransportId(null);
      setTransportName(null);
      setTaskIds([]);
      setLoading(false);
      setSaving(false);
      setError(null);
      return;
    }

    let isActive = true;
    setLoading(true);
    setError(null);
    void getRoutePlan(planId)
      .then((plan) => {
        if (!isActive) return;
        setTitle(plan.title ?? '');
        setNotes(plan.notes ?? '');
        setCreatorId(
          plan.creatorId !== null && plan.creatorId !== undefined
            ? String(plan.creatorId)
            : null,
        );
        setExecutorId(
          plan.executorId !== null && plan.executorId !== undefined
            ? String(plan.executorId)
            : null,
        );
        setCompanyPointIds(
          Array.isArray(plan.companyPointIds) ? plan.companyPointIds : [],
        );
        setTransportId(plan.transportId ?? null);
        setTransportName(plan.transportName ?? null);
        setTaskIds(Array.isArray(plan.tasks) ? plan.tasks : []);
      })
      .catch((err) => {
        if (!isActive) return;
        const message =
          err instanceof Error
            ? err.message
            : 'Не удалось загрузить маршрутный лист';
        setError(message);
      })
      .finally(() => {
        if (!isActive) return;
        setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [open, planId]);

  React.useEffect(() => {
    if (!open) return;
    let isActive = true;
    setUsersLoading(true);
    setUsersError(null);
    void fetchUsers()
      .then((list) => {
        if (!isActive) return;
        setUsers(list);
      })
      .catch((err) => {
        if (!isActive) return;
        const message =
          err instanceof Error
            ? err.message
            : 'Не удалось загрузить сотрудников';
        setUsersError(message);
      })
      .finally(() => {
        if (!isActive) return;
        setUsersLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    let isActive = true;
    setCollectionsLoading(true);
    setCollectionsError(null);
    void fetchAllCollectionObjects()
      .then((items) => {
        if (!isActive) return;
        setCollectionObjects(items);
      })
      .catch((err) => {
        if (!isActive) return;
        const message =
          err instanceof Error
            ? err.message
            : 'Не удалось загрузить точки компании';
        setCollectionsError(message);
      })
      .finally(() => {
        if (!isActive) return;
        setCollectionsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    let isActive = true;
    setTransportLoading(true);
    setTransportError(null);
    void fetchTransportOptions()
      .then((options) => {
        if (!isActive) return;
        setTransportOptions(options.vehicles);
      })
      .catch((err) => {
        if (!isActive) return;
        const message =
          err instanceof Error ? err.message : 'Не удалось загрузить транспорт';
        setTransportError(message);
      })
      .finally(() => {
        if (!isActive) return;
        setTransportLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    let isActive = true;
    setTasksLoading(true);
    setTasksError(null);
    void fetchTasks({ limit: 200 })
      .then((response) => {
        if (!isActive) return;
        setTasks(Array.isArray(response.tasks) ? response.tasks : []);
      })
      .catch((err) => {
        if (!isActive) return;
        const message =
          err instanceof Error ? err.message : 'Не удалось загрузить задачи';
        setTasksError(message);
      })
      .finally(() => {
        if (!isActive) return;
        setTasksLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [open]);

  const userOptions = React.useMemo<SingleSelectOption[]>(() => {
    return users
      .map((user) => {
        const id =
          typeof user.telegram_id === 'number' ? String(user.telegram_id) : '';
        if (!id) return null;
        const label =
          user.name || user.telegram_username || user.username || `ID ${id}`;
        return { value: id, label };
      })
      .filter((option): option is SingleSelectOption => Boolean(option));
  }, [users]);

  const transportSelectOptions = React.useMemo<SingleSelectOption[]>(() => {
    return transportOptions.map((vehicle) => ({
      value: vehicle.id,
      label: vehicle.registrationNumber
        ? `${vehicle.name} (${vehicle.registrationNumber})`
        : vehicle.name,
    }));
  }, [transportOptions]);

  const collectionOptions = React.useMemo(
    () =>
      collectionObjects.map((item) => ({
        value: item._id,
        label: item.name || item.value || item._id,
      })),
    [collectionObjects],
  );

  const taskOptions = React.useMemo(
    () =>
      tasks.map((task) => ({
        value: task._id,
        label: task.title ? `${task.title} (${task._id})` : task._id,
      })),
    [tasks],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = normalizePayload(
        title,
        notes,
        creatorId,
        executorId,
        companyPointIds,
        transportId,
        transportName,
        taskIds,
      );
      const plan = planId
        ? await updateRoutePlan(planId, payload)
        : await createRoutePlan(payload);
      onSaved(plan);
      onClose();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Не удалось сохранить маршрутный лист';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? 'Редактировать маршрутный лист'
              : 'Создать маршрутный лист'}
          </DialogTitle>
          <DialogDescription>
            Укажите название и описание маршрутного листа. Поле названия можно
            оставить пустым — оно будет заполнено автоматически.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <FormGroup label="Название" htmlFor="route-plan-title">
            <Input
              id="route-plan-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="LOG_00001 или произвольное название"
              disabled={loading || saving}
            />
          </FormGroup>
          <FormGroup label="Описание" htmlFor="route-plan-notes">
            <textarea
              id="route-plan-notes"
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-[96px] w-full rounded-md border px-4 py-2 text-sm shadow-xs transition-colors focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Краткое описание маршрута"
              disabled={loading || saving}
            />
          </FormGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <SingleSelect
              label="Создатель"
              options={userOptions}
              value={creatorId}
              onChange={(option) => setCreatorId(option?.value ?? null)}
              disabled={loading || saving || usersLoading}
              placeholder="Выберите сотрудника"
              hint={usersLoading ? 'Загрузка сотрудников…' : undefined}
              error={usersError}
            />
            <SingleSelect
              label="Исполнитель"
              options={userOptions}
              value={executorId}
              onChange={(option) => setExecutorId(option?.value ?? null)}
              disabled={loading || saving || usersLoading}
              placeholder="Выберите сотрудника"
              hint={usersLoading ? 'Загрузка сотрудников…' : undefined}
              error={usersError}
            />
          </div>
          <SingleSelect
            label="Транспорт"
            options={transportSelectOptions}
            value={transportId}
            onChange={(option) => {
              const value = option?.value ?? null;
              setTransportId(value);
              if (!value) {
                setTransportName(null);
                return;
              }
              const vehicle = transportOptions.find(
                (item) => item.id === value,
              );
              setTransportName(vehicle?.name ?? option?.label ?? null);
            }}
            disabled={loading || saving || transportLoading}
            placeholder="Выберите транспорт"
            hint={transportLoading ? 'Загрузка транспорта…' : undefined}
            error={transportError}
          />
          <FormGroup label="Точки компании" htmlFor="route-plan-points">
            <select
              id="route-plan-points"
              multiple
              value={companyPointIds}
              onChange={(event) => {
                const next = Array.from(
                  event.currentTarget.selectedOptions,
                ).map((option) => option.value);
                setCompanyPointIds(next);
              }}
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm shadow-xs transition-colors focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading || saving || collectionsLoading}
              size={Math.min(6, Math.max(collectionOptions.length, 3))}
            >
              {collectionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {collectionsLoading ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Загрузка точек компании…
              </p>
            ) : null}
            {collectionsError ? (
              <p className="mt-1 text-xs text-destructive">
                {collectionsError}
              </p>
            ) : null}
          </FormGroup>
          <FormGroup label="Задачи" htmlFor="route-plan-tasks">
            <select
              id="route-plan-tasks"
              multiple
              value={taskIds}
              onChange={(event) => {
                const next = Array.from(
                  event.currentTarget.selectedOptions,
                ).map((option) => option.value);
                setTaskIds(next);
              }}
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm shadow-xs transition-colors focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading || saving || tasksLoading}
              size={Math.min(8, Math.max(taskOptions.length, 4))}
            >
              {taskOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {tasksLoading ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Загрузка задач…
              </p>
            ) : null}
            {tasksError ? (
              <p className="mt-1 text-xs text-destructive">{tasksError}</p>
            ) : null}
          </FormGroup>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {loading ? (
            <p className="text-sm text-muted-foreground">Загрузка данных…</p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={saving || loading}>
              {saving ? 'Сохраняем…' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
