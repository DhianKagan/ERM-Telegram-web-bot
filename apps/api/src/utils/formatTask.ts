// Форматирование задачи в виде расширенного блока MarkdownV2
// Модули: Intl.DateTimeFormat, userLink, config

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
import {
  PROJECT_TIMEZONE,
  PROJECT_TIMEZONE_LABEL,
  type Task,
  type User,
} from 'shared';
import { appUrl as configuredAppUrl } from '../config';

const toPriorityDisplay = (value: string) =>
  /^бессроч/i.test(value.trim()) ? 'До выполнения' : value;

type UsersIndex = Record<number | string, Pick<User, 'name' | 'username'>>;

const metricFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 3,
  minimumFractionDigits: 0,
});

const weightFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const currencyFormatter = new Intl.NumberFormat('uk-UA', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const taskDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: PROJECT_TIMEZONE,
});

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
  payment_method?: Task['payment_method'];
  priority?: string;
  status?: string;
  route_distance_km?: number;
  controllers?: number[];
  created_by?: number;
  comments?: { author_id?: number; text?: string }[];
  task_description?: string;
};

const appUrlBase = configuredAppUrl.replace(/\/+$/, '');

const isMongoLike = (value: unknown): value is { toString(): string } =>
  Boolean(value && typeof value === 'object' && 'toString' in value);

const toIdentifier = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value === 'number') {
    const str = String(value).trim();
    return str ? str : null;
  }
  if (isMongoLike(value)) {
    const str = value.toString();
    return str ? str : null;
  }
  return null;
};

const buildTaskLink = (task: TaskData) => {
  const canonicalId = toIdentifier(task._id) ?? toIdentifier(task.request_id);
  if (!canonicalId) return null;
  const displayId =
    toIdentifier(task.task_number) ||
    toIdentifier(task.request_id) ||
    canonicalId;
  const link = `${appUrlBase}/tasks/${encodeURIComponent(canonicalId)}`;
  return { displayId, link };
};

export default function formatTask(
  task: TaskData,
  users: UsersIndex = {},
): string {
  const sections: string[] = [];

  const headerParts: string[] = [];
  const linkData = buildTaskLink(task);
  if (linkData) {
    headerParts.push(
      `📌 [${mdEscape(linkData.displayId)}](${mdEscape(linkData.link)})`,
    );
  } else {
    const fallbackId =
      toIdentifier(task.task_number) ||
      toIdentifier(task.request_id) ||
      toIdentifier(task._id);
    if (fallbackId) {
      headerParts.push(`📌 *${mdEscape(fallbackId)}*`);
    }
  }
  if (task.title) {
    headerParts.push(`*${mdEscape(task.title)}*`);
  }
  if (task.task_type) {
    headerParts.push(`🏷 _${mdEscape(task.task_type)}_`);
  }
  if (headerParts.length) {
    sections.push(headerParts.join('\n'));
  }

  const infoLines: string[] = [];
  if (task.start_date) {
    const d = new Date(task.start_date);
    const formatted = taskDateFormatter.format(d).replace(', ', ' ');
    infoLines.push(
      `🗓 Начало: \`${mdEscape(`${formatted} ${PROJECT_TIMEZONE_LABEL}`)}\``,
    );
  }
  if (task.due_date) {
    const d = new Date(task.due_date);
    const formatted = taskDateFormatter.format(d).replace(', ', ' ');
    infoLines.push(
      `⏰ Срок: \`${mdEscape(`${formatted} ${PROJECT_TIMEZONE_LABEL}`)}\``,
    );
  }
  if (task.priority) {
    const priority = toPriorityDisplay(task.priority);
    infoLines.push(`⚡️ Приоритет: _${mdEscape(priority)}_`);
  }
  if (task.status) {
    infoLines.push(`🛠 Статус: _${mdEscape(task.status)}_`);
  }
  if (infoLines.length) {
    sections.push(['🧾 *Информация*', ...infoLines].join('\n'));
  }

  const logisticsLines: string[] = [];
  const start = task.start_location ? mdEscape(task.start_location) : '';
  const end = task.end_location ? mdEscape(task.end_location) : '';
  const startLink = task.start_location_link
    ? `[${start}](${mdEscape(task.start_location_link)})`
    : start;
  const endLink = task.end_location_link
    ? `[${end}](${mdEscape(task.end_location_link)})`
    : end;
  if (start || end) {
    const arrow = start && end ? ' → ' : '';
    logisticsLines.push(`📍 ${startLink}${arrow}${endLink}`);
  }
  if (task.route_distance_km !== undefined && task.route_distance_km !== null) {
    logisticsLines.push(
      `🗺 Расстояние: ${mdEscape(String(task.route_distance_km))} км`,
    );
  }
  if (task.transport_type) {
    logisticsLines.push(`🚗 Транспорт: ${mdEscape(task.transport_type)}`);
  }
  if (task.payment_method) {
    logisticsLines.push(`💰 Оплата: ${mdEscape(task.payment_method)}`);
  }
  if (typeof task.payment_amount === 'number') {
    const formatted = currencyFormatter.format(task.payment_amount);
    logisticsLines.push(`💵 Сумма: ${mdEscape(`${formatted} грн`)}`);
  }
  if (logisticsLines.length) {
    sections.push(['🧭 *Логистика*', ...logisticsLines].join('\n'));
  }

  const cargoLines: string[] = [];
  const lengthValue =
    typeof task.cargo_length_m === 'number'
      ? metricFormatter.format(task.cargo_length_m)
      : null;
  const widthValue =
    typeof task.cargo_width_m === 'number'
      ? metricFormatter.format(task.cargo_width_m)
      : null;
  const heightValue =
    typeof task.cargo_height_m === 'number'
      ? metricFormatter.format(task.cargo_height_m)
      : null;
  if (lengthValue && widthValue && heightValue) {
    cargoLines.push(`Д×Ш×В: ${lengthValue}×${widthValue}×${heightValue} м`);
  } else {
    if (lengthValue) cargoLines.push(`Д: ${lengthValue} м`);
    if (widthValue) cargoLines.push(`Ш: ${widthValue} м`);
    if (heightValue) cargoLines.push(`В: ${heightValue} м`);
  }
  if (typeof task.cargo_volume_m3 === 'number') {
    cargoLines.push(`Объём: ${metricFormatter.format(task.cargo_volume_m3)} м³`);
  }
  if (typeof task.cargo_weight_kg === 'number') {
    cargoLines.push(`Вес: ${weightFormatter.format(task.cargo_weight_kg)} кг`);
  }
  if (cargoLines.length) {
    sections.push(
      ['🚚 *Груз*', ...cargoLines.map((part) => `• ${mdEscape(part)}`)].join('\n'),
    );
  }

  const peopleLines: string[] = [];
  if (Array.isArray(task.assignees) && task.assignees.length) {
    const links = task.assignees
      .map((id: string | number) =>
        userLink(id, users[id]?.name || users[id]?.username),
      )
      .join(', ');
    peopleLines.push(`👥 Исполнители: ${links}`);
  }
  if (Array.isArray(task.controllers) && task.controllers.length) {
    const links = task.controllers
      .map((id: string | number) =>
        userLink(id, users[id]?.name || users[id]?.username),
      )
      .join(', ');
    peopleLines.push(`🕵 Контроль: ${links}`);
  }
  if (task.created_by) {
    peopleLines.push(
      `👤 Создатель: ${userLink(
        task.created_by,
        users[task.created_by]?.name || users[task.created_by]?.username,
      )}`,
    );
  }
  if (peopleLines.length) {
    sections.push(['🤝 *Участники*', ...peopleLines].join('\n'));
  }

  if (task.task_description) {
    const text = stripTags(task.task_description);
    if (text.trim()) {
      sections.push(`📝 *Описание*\n${mdEscape(text.trim())}`);
    }
  }

  return sections.join('\n\n━━━━━━━━━━━━\n\n');
}
