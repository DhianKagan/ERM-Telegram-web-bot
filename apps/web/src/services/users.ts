// Назначение: запросы к API пользователей
// Основные модули: authFetch
import authFetch from "../utils/authFetch";
import type { User } from "../types/user";
import { normalizeUser, normalizeUsers } from "./normalizeUser";

export interface UserDetails extends User {
  email?: string;
  mobNumber?: string;
  name?: string;
}

const referenceFields = new Set<
  "roleId" | "departmentId" | "divisionId" | "positionId"
>(["roleId", "departmentId", "divisionId", "positionId"]);

const normalizeRoleId = (value?: string) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const buildCreateUserBody = (
  id?: number | string,
  username?: string,
  roleId?: string,
) => {
  const payload: Record<string, unknown> = {};
  if (id !== undefined) {
    payload.id = id;
  }
  if (typeof username === "string") {
    const trimmed = username.trim();
    if (trimmed.length > 0) {
      payload.username = trimmed;
    }
  } else if (username !== undefined) {
    payload.username = username;
  }
  const normalizedRoleId = normalizeRoleId(roleId);
  if (normalizedRoleId) {
    payload.roleId = normalizedRoleId;
  }
  return payload;
};

const sanitizeUserUpdatePayload = (data: Partial<User>): Partial<User> => {
  const payload: Partial<User> = {};
  (Object.entries(data) as [keyof User, User[keyof User]][]).forEach(
    ([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (
          referenceFields.has(
            key as "roleId" | "departmentId" | "divisionId" | "positionId",
          )
        ) {
          if (trimmed.length === 0) {
            return;
          }
          payload[key] = trimmed as User[keyof User];
          return;
        }
        payload[key] = trimmed as User[keyof User];
        return;
      }
      payload[key] = value;
    },
  );
  return payload;
};

export const fetchUser = async (
  id: number | string,
): Promise<UserDetails | null> => {
  const res = await authFetch(`/api/v1/users/${id}`, { noRedirect: true });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Не удалось загрузить пользователя");
  }
  const data = await res.json();
  return normalizeUser(data) as UserDetails;
};

export const fetchUsers = async (): Promise<User[]> => {
  const response = await authFetch("/api/v1/users");
  if (response.ok) {
    const data = await response.json();
    return Array.isArray(data) ? (normalizeUsers(data) as User[]) : [];
  }
  const text = await response.text().catch(() => "");
  throw new Error(text || "Не удалось загрузить пользователей");
};

export const createUser = (
  id?: number | string,
  username?: string,
  roleId?: string,
) => {
  const body = buildCreateUserBody(id, username, roleId);
  return authFetch("/api/v1/users", {
    method: "POST",
    confirmed: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (r) => {
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      let message = "Не удалось создать пользователя";
      if (body) {
        try {
          const data = JSON.parse(body) as {
            error?: string;
            message?: string;
            detail?: string;
          };
          message = data.error || data.detail || data.message || message;
        } catch {
          message = body;
        }
      }
      throw new Error(message);
    }
    const data = await r.json();
    return normalizeUser(data);
  });
};

export interface GeneratedUserCredentials {
  telegram_id: number;
  username: string;
}

export const previewUserCredentials = (
  id?: number | string,
  username?: string,
): Promise<GeneratedUserCredentials> =>
  authFetch(`/api/v1/users?preview=1`, {
    method: "POST",
    confirmed: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, username }),
  }).then(async (r) => {
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      let message = "Не удалось получить сгенерированные данные";
      if (body) {
        try {
          const parsed = JSON.parse(body) as {
            error?: string;
            detail?: string;
            message?: string;
          };
          message = parsed.error || parsed.detail || parsed.message || message;
        } catch {
          message = body;
        }
      }
      throw new Error(message);
    }
    return r.json();
  });

export const updateUser = (
  id: number | string,
  data: Partial<User>,
): Promise<UserDetails | null> => {
  const body = sanitizeUserUpdatePayload(data);
  return authFetch(`/api/v1/users/${id}`, {
    method: "PATCH",
    confirmed: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (r) => {
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      let message = "Не удалось обновить пользователя";
      if (body) {
        try {
          const parsed = JSON.parse(body) as {
            error?: string;
            detail?: string;
            message?: string;
          };
          message = parsed.error || parsed.detail || parsed.message || message;
        } catch {
          message = body;
        }
      }
      throw new Error(message);
    }
    const data = await r.json();
    return normalizeUser(data) as UserDetails;
  });
};

export const deleteUser = async (id: number | string): Promise<void> => {
  const response = await authFetch(`/api/v1/users/${id}`, {
    method: "DELETE",
    confirmed: true,
  });
  if (response.status === 404) {
    throw new Error("Пользователь не найден");
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || "Не удалось удалить пользователя");
  }
};
