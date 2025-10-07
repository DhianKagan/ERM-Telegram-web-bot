// Назначение файла: запросы к API настроек задач (подписи полей и темы Telegram).
// Основные модули: authFetch.
import authFetch from "../utils/authFetch";

export interface TaskFieldSettingDto {
  name: string;
  label: string;
  defaultLabel: string;
}

export interface TaskTypeSettingDto {
  taskType: string;
  tg_theme_url: string | null;
  chatId?: string;
  topicId?: number;
}

export interface TaskSettingsResponse {
  fields: TaskFieldSettingDto[];
  types: TaskTypeSettingDto[];
}

const extractErrorMessage = async (response: Response) => {
  try {
    const data = (await response.json()) as { detail?: string };
    if (data?.detail) {
      return data.detail;
    }
  } catch {
    // игнорируем ошибки парсинга
  }
  return response.statusText || "Не удалось выполнить запрос";
};

export const fetchTaskSettings = async (): Promise<TaskSettingsResponse> => {
  const response = await authFetch("/api/v1/task-settings");
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }
  return (await response.json()) as TaskSettingsResponse;
};

export const updateTaskFieldLabel = async (
  name: string,
  label: string,
): Promise<{ name: string; label: string }> => {
  const response = await authFetch(
    `/api/v1/task-settings/fields/${encodeURIComponent(name)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    },
  );
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }
  return (await response.json()) as { name: string; label: string };
};

export const updateTaskTypeTheme = async (
  taskType: string,
  tgThemeUrl: string | null,
): Promise<TaskTypeSettingDto> => {
  const response = await authFetch(
    `/api/v1/task-settings/types/${encodeURIComponent(taskType)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tg_theme_url: tgThemeUrl }),
    },
  );
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }
  return (await response.json()) as TaskTypeSettingDto;
};

export default {
  fetchTaskSettings,
  updateTaskFieldLabel,
  updateTaskTypeTheme,
};
