// Назначение: запросы к API задач
// Основные модули: authFetch, buildTaskFormData
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types/telegram.d.ts" />
import authFetch from "../utils/authFetch";
import { buildTaskFormData } from "./buildTaskFormData";
import type { Task, User } from "shared";
import type { Attachment } from "../types/task";

const STATUS_HINTS: Record<number, string> = {
  400: "Сервер отклонил запрос: проверьте заполненные поля.",
  401: "Сессия истекла. Перезайдите в систему и повторите попытку.",
  403: "Недостаточно прав для выполнения операции.",
  404: "Объект не найден или уже удалён.",
  409: "Данные устарели. Обновите страницу и попробуйте снова.",
  413: "Превышен допустимый размер данных или вложений.",
  422: "Сервер не принял данные. Проверьте обязательные поля.",
  429: "Превышен лимит запросов. Повторите попытку позже.",
  500: "Внутренняя ошибка сервера. Попробуйте повторить действие позже.",
  503: "Сервис временно недоступен. Повторите попытку позже.",
};

const stripControlCharacters = (message: string): string => {
  let result = "";
  for (const char of message) {
    const code = char.charCodeAt(0);
    result += code < 32 || code === 127 ? " " : char;
  }
  return result;
};

const sanitizeReason = (message: string): string =>
  stripControlCharacters(message)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);

const extractReason = async (response: Response): Promise<string> => {
  let reason = "";
  try {
    const data = await response.clone().json();
    if (data && typeof data === "object") {
      const payload = data as Record<string, unknown>;
      if (typeof payload.message === "string") {
        reason = payload.message;
      } else if (typeof payload.error === "string") {
        reason = payload.error;
      } else if (Array.isArray(payload.errors)) {
        reason = payload.errors
          .map((item) => {
            if (!item) return "";
            if (typeof item === "string") return item;
            if (
              typeof item === "object" &&
              typeof (item as Record<string, unknown>).message === "string"
            ) {
              return (item as Record<string, unknown>).message as string;
            }
            return "";
          })
          .filter(Boolean)
          .join(", ");
      }
    }
  } catch {
    reason = "";
  }
  if (!reason) {
    try {
      const text = await response.text();
      reason = text.trim().split(/\r?\n/)[0] ?? "";
    } catch {
      reason = "";
    }
  }
  const fallback = STATUS_HINTS[response.status];
  const normalized = sanitizeReason(reason || "");
  if (normalized) {
    return normalized;
  }
  if (fallback) {
    return fallback;
  }
  if (response.status) {
    const statusText = sanitizeReason(response.statusText || "");
    return statusText
      ? `Код ${response.status}: ${statusText}`
      : `Код ${response.status}`;
  }
  return "Неизвестная ошибка";
};

export class TaskRequestError extends Error {
  status: number;
  statusText: string;
  rawReason: string;

  constructor({
    status,
    statusText,
    reason,
  }: {
    status: number;
    statusText: string;
    reason: string;
  }) {
    const normalized = sanitizeReason(reason || STATUS_HINTS[status] || "");
    super(
      normalized ||
        (status
          ? `Код ${status}${statusText ? `: ${sanitizeReason(statusText)}` : ""}`
          : "Неизвестная ошибка"),
    );
    this.name = "TaskRequestError";
    this.status = status;
    this.statusText = statusText;
    this.rawReason = reason;
  }
}

export const fetchKanban = () =>
  authFetch("/api/v1/tasks?kanban=true&kind=task")
    .then((r) => (r.ok ? r.json() : []))
    .then((data) => (Array.isArray(data) ? data : data.tasks || []));

export const updateTaskStatus = (id: string, status: string) =>
  authFetch(`/api/v1/tasks/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

const submitTask = async (
  endpoint: string,
  data: Record<string, unknown>,
  files?: FileList | File[],
  onProgress?: (e: ProgressEvent) => void,
) => {
  const body = buildTaskFormData(data, files);
  const response = await authFetch(endpoint, {
    method: "POST",
    body,
    onProgress,
  });
  if (!response.ok) {
    throw new TaskRequestError({
      status: response.status,
      statusText: response.statusText,
      reason: await extractReason(response),
    });
  }
  const result = (await response.json()) as { _id?: string; id?: string };
  const id = result._id || result.id;
  if (id && window.Telegram?.WebApp) {
    window.Telegram.WebApp.sendData(`task_created:${id}`);
  }
  clearTasksCache();
  return result;
};

export const createTask = async (
  data: Record<string, unknown>,
  files?: FileList | File[],
  onProgress?: (e: ProgressEvent) => void,
) => submitTask("/api/v1/tasks", data, files, onProgress);

export const createRequest = async (
  data: Record<string, unknown>,
  files?: FileList | File[],
  onProgress?: (e: ProgressEvent) => void,
) => submitTask("/api/v1/tasks/requests", data, files, onProgress);

export const deleteTask = (id: string) =>
  authFetch(`/api/v1/tasks/${id}`, {
    method: "DELETE",
  });

export const updateTask = async (
  id: string,
  data: Record<string, unknown>,
  files?: FileList | File[],
  onProgress?: (e: ProgressEvent) => void,
) => {
  const body = buildTaskFormData(data, files);
  const response = await authFetch(`/api/v1/tasks/${id}`, {
    method: "PATCH",
    body,
    onProgress,
  });
  if (!response.ok) {
    throw new TaskRequestError({
      status: response.status,
      statusText: response.statusText,
      reason: await extractReason(response),
    });
  }
  clearTasksCache();
  return response;
};

export const fetchMentioned = () =>
  authFetch("/api/v1/tasks/mentioned").then((r) => (r.ok ? r.json() : []));

export interface TransportDriverOption {
  id: number;
  name: string;
  username?: string | null;
}

export interface TransportVehicleOption {
  id: string;
  name: string;
  registrationNumber: string;
  transportType: "Легковой" | "Грузовой";
  defaultDriverId: number | null;
}

export interface TransportOptionsResponse {
  drivers: TransportDriverOption[];
  vehicles: TransportVehicleOption[];
}

export const fetchTransportOptions = async (): Promise<TransportOptionsResponse> => {
  const res = await authFetch("/api/v1/tasks/transport-options");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Не удалось загрузить данные транспорта");
  }
  const data = (await res.json()) as {
    drivers?: Array<{ id: number; name?: string; username?: string | null }>;
    vehicles?: Array<{
      id: string;
      name: string;
      registrationNumber: string;
      transportType?: "Легковой" | "Грузовой";
      defaultDriverId?: number | null;
    }>;
  };
  const drivers = Array.isArray(data.drivers)
    ? data.drivers.map((driver) => ({
        id: driver.id,
        name:
          typeof driver.name === "string" && driver.name.trim().length > 0
            ? driver.name.trim()
            : driver.username ?? String(driver.id),
        username: driver.username ?? null,
      }))
    : [];
  const vehicles: TransportVehicleOption[] = Array.isArray(data.vehicles)
    ? data.vehicles.map(
        (vehicle): TransportVehicleOption => ({
          id: vehicle.id,
          name: vehicle.name,
          registrationNumber: vehicle.registrationNumber,
          transportType:
            vehicle.transportType === "Грузовой" ? "Грузовой" : "Легковой",
          defaultDriverId:
            typeof vehicle.defaultDriverId === "number" &&
            Number.isFinite(vehicle.defaultDriverId) &&
            vehicle.defaultDriverId > 0
              ? Math.trunc(vehicle.defaultDriverId)
              : null,
        }),
      )
    : [];
  return { drivers, vehicles };
};

export const fetchRequestExecutors = (): Promise<User[]> =>
  authFetch("/api/v1/tasks/executors?kind=request")
    .then((r) => (r.ok ? r.json() : []))
    .then((list) =>
      Array.isArray(list)
        ? (list as User[]).map((item) => ({
            telegram_id: item.telegram_id,
            name: item.name,
            username: item.username,
            telegram_username:
              (item as User & { telegram_username?: string }).telegram_username ??
              item.username ??
              null,
          }))
        : [],
    );

export interface TasksResponse {
  tasks: Task[];
  users: User[] | Record<string, User>;
  total: number;
}

export const clearTasksCache = () => {
  // Удаляем все ключи кеша задач
  Object.keys(localStorage)
    .filter((k) => k.startsWith("tasks_"))
    .forEach((k) => localStorage.removeItem(k));
};

export const clearAnonTasksCache = () => {
  Object.keys(localStorage)
    .filter((k) => k.startsWith("tasks_anon_"))
    .forEach((k) => localStorage.removeItem(k));
};

export interface TaskDraft {
  id: string;
  kind: "task" | "request";
  payload: Record<string, unknown>;
  attachments: Attachment[];
  updatedAt: string | null;
}

const mapTaskDraft = (data: Record<string, unknown>): TaskDraft => ({
  id: String(data.id ?? data._id ?? ""),
  kind:
    data.kind === "request"
      ? "request"
      : (data.kind as "task" | "request") ?? "task",
  payload: (data.payload as Record<string, unknown>) ?? {},
  attachments: Array.isArray(data.attachments)
    ? (data.attachments as Attachment[])
    : [],
  updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
});

export const fetchTaskDraft = async (
  kind: "task" | "request",
): Promise<TaskDraft | null> => {
  const res = await authFetch(`/api/v1/task-drafts/${kind}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new TaskRequestError({
      status: res.status,
      statusText: res.statusText,
      reason: await extractReason(res),
    });
  }
  const data = (await res.json()) as Record<string, unknown>;
  return mapTaskDraft(data);
};

export const saveTaskDraft = async (
  kind: "task" | "request",
  payload: Record<string, unknown>,
): Promise<TaskDraft> => {
  const res = await authFetch(`/api/v1/task-drafts/${kind}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) {
    throw new TaskRequestError({
      status: res.status,
      statusText: res.statusText,
      reason: await extractReason(res),
    });
  }
  const data = (await res.json()) as Record<string, unknown>;
  return mapTaskDraft(data);
};

export const deleteTaskDraft = async (kind: "task" | "request"): Promise<void> => {
  const res = await authFetch(`/api/v1/task-drafts/${kind}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 404) {
    throw new TaskRequestError({
      status: res.status,
      statusText: res.statusText,
      reason: await extractReason(res),
    });
  }
};

export const fetchTasks = (
  params: Record<string, unknown> = {},
  userId?: number,
  skipCache = false,
): Promise<TasksResponse> => {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null),
  );
  const q = new URLSearchParams(filtered as Record<string, string>).toString();
  const url = "/api/v1/tasks" + (q ? `?${q}` : "");
  const key = `tasks_${userId ?? "anon"}_${q}`;
  let cached: { time?: number; data?: TasksResponse } = {};
  if (!skipCache) {
    try {
      cached = JSON.parse(localStorage.getItem(key) || "");
    } catch {
      // игнорируем ошибку парсинга
      cached = {};
    }
    if (cached.time && Date.now() - cached.time < 60000 && cached.data) {
      return Promise.resolve(cached.data);
    }
  }
  return authFetch(url)
    .then((r) =>
      r.ok ? r.json() : ({ tasks: [], users: [], total: 0 } as TasksResponse),
    )
    .then((d: TasksResponse) => {
      if (!skipCache) {
        try {
          localStorage.setItem(
            key,
            JSON.stringify({ time: Date.now(), data: d }),
          );
        } catch {
          // игнорируем переполнение
        }
      }
      return d;
    });
};
