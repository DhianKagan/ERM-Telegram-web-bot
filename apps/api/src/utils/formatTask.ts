// Форматирование задачи в виде компактного блока MarkdownV2
// Модули: Intl.DateTimeFormat, userLink

function mdEscape(str: unknown): string {
  // eslint-disable-next-line no-useless-escape
  return String(str).replace(/[\\_*\[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

function stripTags(html: unknown): string {
  let prev: string;
  let out = String(html);
  do {
    prev = out;
    out = out.replace(/<[^>]*>/g, '');
  } while (out !== prev);
  return out;
}

import userLink from './userLink';
import type { Task, User } from 'shared';

type UsersIndex = Record<number | string, Pick<User, 'name' | 'username'>>;

type TaskData = Task & {
  request_id?: string;
  task_number?: string;
  task_type?: string;
  due_date?: string | Date;
  start_date?: string | Date;
  start_location?: string;
  end_location?: string;
  start_location_link?: string;
  end_location_link?: string;
  transport_type?: string;
  payment_method?: string;
  priority?: string;
  status?: string;
  route_distance_km?: number;
  controllers?: number[];
  created_by?: number;
  comments?: { author_id?: number; text?: string }[];
  task_description?: string;
};

export default function formatTask(
  task: TaskData,
  users: UsersIndex = {},
): string {
  const lines: string[] = [];
  const idTitle = [task.task_number || task.request_id, task.title]
    .filter(Boolean)
    .join(' ');
  if (idTitle) lines.push(`📌 *Задача:* _${mdEscape(idTitle)}_`);

  if (task.task_type) {
    lines.push(`🏷 *Тип:* _${mdEscape(task.task_type)}_`);
  }

  if (task.due_date) {
    const d = new Date(task.due_date);
    lines.push(
      `⏰ *Срок:* \`${mdEscape(new Intl.DateTimeFormat('ru-RU').format(d))}\``,
    );
  }

  if (task.start_date) {
    const d = new Date(task.start_date);
    lines.push(
      `🗓 *Начало:* \`${mdEscape(new Intl.DateTimeFormat('ru-RU').format(d))}\``,
    );
  }

  const start = task.start_location ? mdEscape(task.start_location) : '';
  const end = task.end_location ? mdEscape(task.end_location) : '';
  const startLink = task.start_location_link
    ? `[${start}](${mdEscape(task.start_location_link)})`
    : start;
  const endLink = task.end_location_link
    ? `[${end}](${mdEscape(task.end_location_link)})`
    : end;
  if (start || end)
    lines.push(`📍 ${startLink}${start && end ? ' → ' : ''}${endLink}`);

  const extra: string[] = [];
  if (task.transport_type) extra.push(`🚗 ${mdEscape(task.transport_type)}`);
  if (task.payment_method) extra.push(`💰 ${mdEscape(task.payment_method)}`);
  if (extra.length) lines.push(extra.join(' • '));

  const ps: string[] = [];
  if (task.priority) ps.push(`*Приоритет:* _${mdEscape(task.priority)}_`);
  if (task.status) ps.push(`🛠 *Статус:* _${mdEscape(task.status)}_`);
  if (ps.length) lines.push(`🔁 ${ps.join(' • ')}`);

  if (task.route_distance_km) {
    lines.push(
      `🗺 *Расстояние:* ${mdEscape(String(task.route_distance_km))} км`,
    );
  }

  if (Array.isArray(task.assignees) && task.assignees.length) {
    const links = task.assignees
      .map((id: string | number) =>
        userLink(id, users[id]?.name || users[id]?.username),
      )
      .join(', ');
    lines.push(`👥 *Исполнители:* ${links}`);
  }

  if (Array.isArray(task.controllers) && task.controllers.length) {
    const links = task.controllers
      .map((id: string | number) =>
        userLink(id, users[id]?.name || users[id]?.username),
      )
      .join(', ');
    lines.push(`🕵 *Контроль:* ${links}`);
  }

  if (task.created_by) {
    lines.push(
      `👤 *Создатель:* ${userLink(task.created_by, users[task.created_by]?.name || users[task.created_by]?.username)}`,
    );
  }

  if (task.task_description) {
    const text = stripTags(task.task_description);
    if (text.trim()) lines.push(`📝 ${mdEscape(text.trim())}`);
  }

  return lines.join('\n');
}
