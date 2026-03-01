// Диалог создания и редактирования маршрутных листов
// Основные модули: React, routePlans, ui/dialog
import React from 'react';
import { extractCoords, type RoutePlan, type Task } from 'shared';

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

type RouteSourcePoint = {
  key: string;
  title: string;
  subtitle?: string;
  lat: number;
  lng: number;
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

const normalizeText = (value: string | null | undefined): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const formatCoordinates = (lat: number, lng: number): string =>
  `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

const parseTaskPoints = (task: Task): RouteSourcePoint[] => {
  const result: RouteSourcePoint[] = [];
  const addPoint = (
    key: string,
    title: string,
    coordinates?: { lat: number; lng: number } | null,
    subtitle?: string,
  ) => {
    if (!coordinates) return;
    if (
      !Number.isFinite(coordinates.lat) ||
      !Number.isFinite(coordinates.lng)
    ) {
      return;
    }
    result.push({
      key,
      title,
      subtitle,
      lat: coordinates.lat,
      lng: coordinates.lng,
    });
  };

  if (Array.isArray(task.points) && task.points.length) {
    task.points.forEach((point, index) => {
      addPoint(
        `${task._id}-point-${index}`,
        point.title || `Точка ${index + 1}`,
        point.coordinates,
        point.kind ? `Тип: ${point.kind}` : undefined,
      );
      if (!point.coordinates && point.sourceUrl) {
        const parsed = extractCoords(point.sourceUrl);
        addPoint(
          `${task._id}-point-url-${index}`,
          point.title || `Google точка ${index + 1}`,
          parsed,
          'Координаты извлечены из ссылки Google Maps',
        );
      }
    });
  }

  addPoint(
    `${task._id}-start`,
    'Старт',
    task.startCoordinates,
    task.start_location ?? undefined,
  );
  addPoint(
    `${task._id}-finish`,
    'Финиш',
    task.finishCoordinates,
    task.end_location ?? undefined,
  );

  if ((!result.length || !task.points?.length) && task.google_route_url) {
    const parsed = extractCoords(task.google_route_url);
    addPoint(
      `${task._id}-route-url`,
      'Google Maps',
      parsed,
      'Координаты извлечены из google_route_url',
    );
  }

  return result;
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
  const [companySearch, setCompanySearch] = React.useState('');
  const [taskSearch, setTaskSearch] = React.useState('');
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
      setCompanySearch('');
      setTaskSearch('');
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
      setCompanySearch('');
      setTaskSearch('');
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

  const filteredCollectionObjects = React.useMemo(() => {
    const q = normalizeText(companySearch);
    if (!q) return collectionObjects;
    return collectionObjects.filter((item) => {
      const candidate =
        `${item.name} ${item.address} ${item.value}`.toLowerCase();
      return candidate.includes(q);
    });
  }, [collectionObjects, companySearch]);

  const selectedTaskIds = React.useMemo(() => new Set(taskIds), [taskIds]);

  const filteredTasks = React.useMemo(() => {
    const q = normalizeText(taskSearch);
    if (!q) return tasks;
    return tasks.filter((task) => {
      const candidate =
        `${task.title} ${task._id} ${task.task_number ?? ''} ${task.request_id ?? ''} ${task.start_location ?? ''} ${task.end_location ?? ''}`.toLowerCase();
      return candidate.includes(q);
    });
  }, [tasks, taskSearch]);

  const taskPointMap = React.useMemo(() => {
    return new Map(tasks.map((task) => [task._id, parseTaskPoints(task)]));
  }, [tasks]);

  const selectedTaskSummaries = React.useMemo(() => {
    return taskIds
      .map((taskId) => tasks.find((task) => task._id === taskId))
      .filter((task): task is Task => Boolean(task))
      .map((task) => {
        const points = taskPointMap.get(task._id) ?? [];
        return {
          task,
          points,
          hasCoordinates: points.length > 0,
        };
      });
  }, [taskIds, tasks, taskPointMap]);

  const selectedCompanyPoints = React.useMemo(() => {
    const selected = new Set(companyPointIds);
    return collectionObjects.filter((item) => selected.has(item._id));
  }, [collectionObjects, companyPointIds]);

  const routePreview = React.useMemo(() => {
    const companyStops = selectedCompanyPoints
      .map((point) => {
        const lat =
          typeof point.latitude === 'number'
            ? point.latitude
            : typeof point.meta?.latitude === 'number'
              ? point.meta.latitude
              : typeof point.meta?.location?.lat === 'number'
                ? point.meta.location.lat
                : undefined;
        const lng =
          typeof point.longitude === 'number'
            ? point.longitude
            : typeof point.meta?.longitude === 'number'
              ? point.meta.longitude
              : typeof point.meta?.location?.lng === 'number'
                ? point.meta.location.lng
                : undefined;
        if (typeof lat !== 'number' || typeof lng !== 'number') {
          return null;
        }
        return {
          key: `company-${point._id}`,
          source: 'company' as const,
          title: point.name || point.value || point._id,
          details: point.address || point.meta?.address || undefined,
          lat,
          lng,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const taskStops = selectedTaskSummaries.flatMap(({ task, points }) =>
      points.map((point) => ({
        key: `task-${task._id}-${point.key}`,
        source: 'task' as const,
        title: `${task.title || task._id} · ${point.title}`,
        details: point.subtitle,
        lat: point.lat,
        lng: point.lng,
      })),
    );

    return [...companyStops, ...taskStops];
  }, [selectedCompanyPoints, selectedTaskSummaries]);

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
      <DialogContent className="max-h-[90vh] w-[calc(100%-1rem)] overflow-y-auto overflow-x-hidden p-4 sm:max-w-5xl sm:p-6">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? 'Редактировать маршрутный лист'
              : 'Создать маршрутный лист'}
          </DialogTitle>
          <DialogDescription>
            Свяжите маршрутный лист с задачами и точками: координаты из точек
            задач и Google Maps будут учтены при расчете маршрута.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 lg:grid-cols-2">
            <FormGroup label="Название" htmlFor="route-plan-title">
              <Input
                id="route-plan-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="LOG_00001 или произвольное название"
                disabled={loading || saving}
              />
            </FormGroup>
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
          </div>

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

          <div className="grid gap-4 lg:grid-cols-2">
            <FormGroup
              label="Точки компании"
              htmlFor="route-plan-points-search"
            >
              <div className="space-y-2 rounded-md border p-3">
                <Input
                  id="route-plan-points-search"
                  value={companySearch}
                  onChange={(event) => setCompanySearch(event.target.value)}
                  placeholder="Поиск по названию или адресу"
                  disabled={loading || saving || collectionsLoading}
                />
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {filteredCollectionObjects.map((item) => {
                    const checked = companyPointIds.includes(item._id);
                    const lat =
                      typeof item.latitude === 'number'
                        ? item.latitude
                        : typeof item.meta?.latitude === 'number'
                          ? item.meta.latitude
                          : item.meta?.location?.lat;
                    const lng =
                      typeof item.longitude === 'number'
                        ? item.longitude
                        : typeof item.meta?.longitude === 'number'
                          ? item.meta.longitude
                          : item.meta?.location?.lng;
                    return (
                      <label
                        key={item._id}
                        className="flex cursor-pointer items-start gap-3 rounded border p-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            setCompanyPointIds((prev) => {
                              if (event.target.checked) {
                                return prev.includes(item._id)
                                  ? prev
                                  : [...prev, item._id];
                              }
                              return prev.filter((value) => value !== item._id);
                            });
                          }}
                          disabled={loading || saving || collectionsLoading}
                          className="mt-1"
                        />
                        <span className="space-y-1">
                          <span className="block font-medium">
                            {item.name || item.value || item._id}
                          </span>
                          {item.address ? (
                            <span className="block text-xs text-muted-foreground">
                              {item.address}
                            </span>
                          ) : null}
                          {typeof lat === 'number' &&
                          typeof lng === 'number' ? (
                            <span className="block text-xs text-muted-foreground">
                              {formatCoordinates(lat, lng)}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                  {!filteredCollectionObjects.length && !collectionsLoading ? (
                    <p className="text-xs text-muted-foreground">
                      Точки не найдены
                    </p>
                  ) : null}
                </div>
                {collectionsLoading ? (
                  <p className="text-xs text-muted-foreground">
                    Загрузка точек компании…
                  </p>
                ) : null}
                {collectionsError ? (
                  <p className="text-xs text-destructive">{collectionsError}</p>
                ) : null}
              </div>
            </FormGroup>

            <FormGroup label="Задачи" htmlFor="route-plan-task-search">
              <div className="space-y-2 rounded-md border p-3">
                <Input
                  id="route-plan-task-search"
                  value={taskSearch}
                  onChange={(event) => setTaskSearch(event.target.value)}
                  placeholder="Поиск по ID, номеру или названию"
                  disabled={loading || saving || tasksLoading}
                />
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {filteredTasks.map((task) => {
                    const checked = selectedTaskIds.has(task._id);
                    const pointCount = taskPointMap.get(task._id)?.length ?? 0;
                    return (
                      <label
                        key={task._id}
                        className="flex cursor-pointer items-start gap-3 rounded border p-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            setTaskIds((prev) => {
                              if (event.target.checked) {
                                return prev.includes(task._id)
                                  ? prev
                                  : [...prev, task._id];
                              }
                              return prev.filter((value) => value !== task._id);
                            });
                          }}
                          disabled={loading || saving || tasksLoading}
                          className="mt-1"
                        />
                        <span className="space-y-1">
                          <span className="block font-medium">
                            {task.title || task._id}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            ID: {task._id}
                            {task.task_number ? ` · № ${task.task_number}` : ''}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            Точек с координатами: {pointCount}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                  {!filteredTasks.length && !tasksLoading ? (
                    <p className="text-xs text-muted-foreground">
                      Задачи не найдены
                    </p>
                  ) : null}
                </div>
                {tasksLoading ? (
                  <p className="text-xs text-muted-foreground">
                    Загрузка задач…
                  </p>
                ) : null}
                {tasksError ? (
                  <p className="text-xs text-destructive">{tasksError}</p>
                ) : null}
              </div>
            </FormGroup>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border p-3">
              <h3 className="text-sm font-semibold">
                Связанные задачи и точки
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Для каждой задачи показываем найденные точки, включая координаты
                из ссылок Google Maps.
              </p>
              <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
                {selectedTaskSummaries.map(
                  ({ task, points, hasCoordinates }) => (
                    <div key={task._id} className="rounded border p-2 text-xs">
                      <p className="font-medium">{task.title || task._id}</p>
                      <p className="text-muted-foreground">ID: {task._id}</p>
                      {!hasCoordinates ? (
                        <p className="mt-1 text-amber-600">
                          Координаты не найдены, задача сохранится без геоточек.
                        </p>
                      ) : (
                        <ul className="mt-1 space-y-1 text-muted-foreground">
                          {points.map((point) => (
                            <li key={point.key}>
                              {point.title}:{' '}
                              {formatCoordinates(point.lat, point.lng)}
                              {point.subtitle ? ` · ${point.subtitle}` : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ),
                )}
                {!selectedTaskSummaries.length ? (
                  <p className="text-xs text-muted-foreground">
                    Выберите задачи, чтобы связать их с маршрутным листом.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-md border p-3">
              <h3 className="text-sm font-semibold">
                Предпросмотр источников маршрута
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                В маршрут попадут точки компании и координаты из выбранных
                задач.
              </p>
              <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1 text-xs">
                {routePreview.map((stop, index) => (
                  <div key={stop.key} className="rounded border p-2">
                    <p className="font-medium">
                      {index + 1}. {stop.title}
                    </p>
                    <p className="text-muted-foreground">
                      Источник:{' '}
                      {stop.source === 'company' ? 'Точка компании' : 'Задача'}
                    </p>
                    <p className="text-muted-foreground">
                      {formatCoordinates(stop.lat, stop.lng)}
                    </p>
                    {stop.details ? (
                      <p className="text-muted-foreground">{stop.details}</p>
                    ) : null}
                  </div>
                ))}
                {!routePreview.length ? (
                  <p className="text-xs text-muted-foreground">
                    Добавьте задачи или точки компании, чтобы увидеть маршрутные
                    координаты.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

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
