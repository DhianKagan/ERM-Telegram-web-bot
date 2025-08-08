// Назначение: типы описания ошибок в формате RFC 9457
// Основные модули: нет
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
}
