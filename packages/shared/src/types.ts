// Назначение: общие интерфейсы Task и User.
// Модули: отсутствуют

export interface Task {
  _id: string;
  title: string;
  status: string;
  assignees?: number[];
  [key: string]: unknown;
}

export interface User {
  telegram_id: number;
  username: string;
  name?: string;
  phone?: string;
  role?: string;
}
