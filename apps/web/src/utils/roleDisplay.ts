// Назначение файла: функции и константы для отображения названий ролей
// Основные модули: словарь соответствий ролей и экспортируемые утилиты

export const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  manager: "Менеджер",
  user: "Сотрудник",
};

export interface RoleOption {
  value: string;
  label: string;
}

export const ROLE_OPTIONS: RoleOption[] = [
  { value: "admin", label: ROLE_LABELS.admin },
  { value: "manager", label: ROLE_LABELS.manager },
  { value: "user", label: ROLE_LABELS.user },
];

export const formatRoleName = (role?: string | null): string => {
  if (!role) return "—";
  return ROLE_LABELS[role] ?? role;
};
