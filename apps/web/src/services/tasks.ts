// Назначение: запросы к API задач
// Основные модули: authFetch, buildTaskFormData
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types/telegram.d.ts" />
import authFetch from "../utils/authFetch";
import { buildTaskFormData } from "./buildTaskFormData";
import type { Task, User } from "shared";

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
