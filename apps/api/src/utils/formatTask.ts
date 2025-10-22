// Форматирование задачи в виде расширенного блока MarkdownV2
// Основные модули: Intl.DateTimeFormat, userLink, config, mdEscape, htmlparser2

import { parseDocument } from 'htmlparser2';
import type { DataNode, Element, Node as DomNode } from 'domhandler';
import userLink from './userLink';
import { escapeMarkdownV2 as mdEscape } from './mdEscape';
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

const COMPLETION_THRESHOLD_MS = 60_000;
const MS_IN_MINUTE = 60 * 1000;
const MINUTES_IN_DAY = 24 * 60;

const parseDateInput = (value?: string | Date | null): Date | null => {
  if (!value) {
    return null;
  }
  const candidate = value instanceof Date ? value : new Date(value);
  return Number.isNaN(candidate.getTime()) ? null : candidate;
};

const getRussianPlural = (
  value: number,
  forms: [string, string, string],
) => {
  const absValue = Math.abs(value) % 100;
  if (absValue >= 11 && absValue <= 14) {
    return forms[2];
  }
  const lastDigit = absValue % 10;
  if (lastDigit === 1) {
    return forms[0];
  }
  if (lastDigit >= 2 && lastDigit <= 4) {
    return forms[1];
  }
  return forms[2];
};

const formatCompletionOffset = (diffMs: number): string | null => {
  const absValue = Math.abs(diffMs);
  if (absValue < COMPLETION_THRESHOLD_MS) {
    return 'менее минуты';
  }
  const totalMinutes = Math.max(0, Math.floor(absValue / MS_IN_MINUTE));
  const days = Math.floor(totalMinutes / MINUTES_IN_DAY);
  const hours = Math.floor((totalMinutes % MINUTES_IN_DAY) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days) {
    parts.push(`${days} ${getRussianPlural(days, ['день', 'дня', 'дней'])}`);
  }
  if (hours) {
    parts.push(`${hours} ${getRussianPlural(hours, ['час', 'часа', 'часов'])}`);
  }
  if (minutes && parts.length < 2) {
    parts.push(
      `${minutes} ${getRussianPlural(minutes, ['минута', 'минуты', 'минут'])}`,
    );
  }
  if (!parts.length) {
    return 'менее минуты';
  }
  return parts.slice(0, 2).join(' ');
};

const buildCompletionNote = (
  status: Task['status'] | undefined,
  dueValue?: string | Date,
  completedValue?: string | Date | null,
) => {
  if (status !== 'Выполнена') {
    return null;
  }
  const dueDate = parseDateInput(dueValue);
  const completedDate = parseDateInput(completedValue);
  if (!dueDate || !completedDate) {
    return null;
  }
  const diff = completedDate.getTime() - dueDate.getTime();
  if (!Number.isFinite(diff)) {
    return null;
  }
  if (Math.abs(diff) < COMPLETION_THRESHOLD_MS) {
    return 'Выполнена точно в срок';
  }
  const offset = formatCompletionOffset(diff);
  if (!offset) {
    return 'Выполнена точно в срок';
  }
  return diff < 0
    ? `Выполнена досрочно на ${offset}`
    : `Выполнена с опозданием на ${offset}`;
};

type BadgeColor = {
  color: string;
  opacity?: number;
};

type BadgeStyle = {
  fill: BadgeColor;
  ring?: BadgeColor;
};

const ACCENT_HEX = '#465fff';
const PRIMARY_HEX = '#2563eb';
const DESTRUCTIVE_HEX = '#f04438';
const ROSE_500_HEX = '#f43f5e';
const SKY_500_HEX = '#0ea5e9';
const SLATE_500_HEX = '#64748b';

const STATUS_COLOR_MAP: Record<string, BadgeStyle> = {
  Новая: {
    fill: { color: '#3b82f6', opacity: 0.75 },
    ring: { color: PRIMARY_HEX, opacity: 0.35 },
  },
  'В работе': {
    fill: { color: '#22c55e', opacity: 0.75 },
    ring: { color: '#16a34a', opacity: 0.4 },
  },
  Выполнена: {
    fill: { color: '#facc15', opacity: 0.75 },
    ring: { color: '#eab308', opacity: 0.4 },
  },
  Отменена: {
    fill: { color: DESTRUCTIVE_HEX, opacity: 0.7 },
    ring: { color: DESTRUCTIVE_HEX, opacity: 0.45 },
  },
};

const PRIORITY_COLOR_MAP: Record<string, BadgeStyle> = {
  'срочно': {
    fill: { color: ROSE_500_HEX, opacity: 0.2 },
    ring: { color: ROSE_500_HEX, opacity: 0.4 },
  },
  'в течение дня': {
    fill: { color: SKY_500_HEX, opacity: 0.2 },
    ring: { color: SKY_500_HEX, opacity: 0.4 },
  },
  'до выполнения': {
    fill: { color: SLATE_500_HEX, opacity: 0.25 },
    ring: { color: SLATE_500_HEX, opacity: 0.45 },
  },
};

const PRIORITY_COLOR_RULES: {
  test(value: string): boolean;
  style: BadgeStyle;
}[] = [
  {
    test: (value) => /сроч|urgent/.test(value),
    style: {
      fill: { color: ACCENT_HEX, opacity: 0.8 },
      ring: { color: DESTRUCTIVE_HEX, opacity: 0.4 },
    },
  },
  {
    test: (value) => /высок|повыш|high/.test(value),
    style: {
      fill: { color: ACCENT_HEX, opacity: 0.75 },
      ring: { color: PRIMARY_HEX, opacity: 0.4 },
    },
  },
  {
    test: (value) => /низк|бесср|без\s+срок|до\s+выполн|low|minor/.test(value),
    style: {
      fill: { color: ACCENT_HEX, opacity: 0.5 },
      ring: { color: PRIMARY_HEX, opacity: 0.2 },
    },
  },
  {
    test: (value) => /обыч|дня|сутк|norm|stand/.test(value),
    style: {
      fill: { color: ACCENT_HEX, opacity: 0.65 },
      ring: { color: PRIMARY_HEX, opacity: 0.3 },
    },
  },
];

const PRIORITY_COLOR_FALLBACK: BadgeStyle = {
  fill: { color: ACCENT_HEX, opacity: 0.6 },
  ring: { color: PRIMARY_HEX, opacity: 0.3 },
};

type EmojiColorEntry = { emoji: string; rgb: [number, number, number] };

const COLOR_EMOJI_PALETTE: EmojiColorEntry[] = [
  { emoji: '⚪', rgb: [248, 250, 252] },
  { emoji: '🟡', rgb: [250, 204, 21] },
  { emoji: '🟢', rgb: [34, 197, 94] },
  { emoji: '🔴', rgb: [239, 68, 68] },
  { emoji: '🟥', rgb: [244, 63, 94] },
  { emoji: '🟧', rgb: [249, 115, 22] },
  { emoji: '🟦', rgb: [59, 130, 246] },
  { emoji: '⬜', rgb: [241, 245, 249] },
];

const hexToRgb = (value: string): [number, number, number] | null => {
  const trimmed = value.trim().replace(/^#/, '');
  if (trimmed.length !== 3 && trimmed.length !== 6) {
    return null;
  }
  const normalized =
    trimmed.length === 3
      ? trimmed
          .split('')
          .map((char) => char + char)
          .join('')
      : trimmed;
  const parsed = Number.parseInt(normalized, 16);
  if (Number.isNaN(parsed)) {
    return null;
  }
  const r = (parsed >> 16) & 0xff;
  const g = (parsed >> 8) & 0xff;
  const b = parsed & 0xff;
  return [r, g, b];
};

const pickColorEmoji = (value: string): string | null => {
  const rgb = hexToRgb(value);
  if (!rgb) {
    return null;
  }
  let best: EmojiColorEntry | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of COLOR_EMOJI_PALETTE) {
    const [cr, cg, cb] = candidate.rgb;
    const distance =
      (rgb[0] - cr) * (rgb[0] - cr) +
      (rgb[1] - cg) * (rgb[1] - cg) +
      (rgb[2] - cb) * (rgb[2] - cb);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best ? best.emoji : null;
};

const resolveStatusStyle = (
  value: string | undefined | null,
): BadgeStyle | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return STATUS_COLOR_MAP[trimmed] ?? null;
};

const resolvePriorityStyle = (
  value: string | undefined | null,
): BadgeStyle | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.toLowerCase();
  if (PRIORITY_COLOR_MAP[normalized]) {
    return PRIORITY_COLOR_MAP[normalized];
  }
  for (const rule of PRIORITY_COLOR_RULES) {
    if (rule.test(normalized)) {
      return rule.style;
    }
  }
  return PRIORITY_COLOR_FALLBACK;
};

const emphasizeValue = (
  value: string,
  style: BadgeStyle | null,
  options: { fallbackEmoji?: string } = {},
): string => {
  const emojiCandidate =
    style?.fill?.color ? pickColorEmoji(style.fill.color) : null;
  const emoji = emojiCandidate ?? options.fallbackEmoji ?? '';
  const escaped = mdEscape(value);
  const prefix = emoji ? `${emoji} ` : '';
  return `*${prefix}${escaped}*`;
};

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

const SECTION_SEPARATOR = '\n\n━━━━━━━━━━━━\n\n';

type InlineImage = { url: string; alt?: string };

type FormatTaskSectionKey =
  | 'header'
  | 'info'
  | 'logistics'
  | 'participants'
  | 'description';

type FormatTaskSection = {
  key: FormatTaskSectionKey;
  content: string;
};

type FormatTaskResult = {
  text: string;
  inlineImages: InlineImage[];
  sections: FormatTaskSection[];
};

const HTTP_URL_REGEXP = /^https?:\/\//i;

const toAbsoluteUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (HTTP_URL_REGEXP.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  if (!appUrlBase) return trimmed;
  const normalizedPath = trimmed.startsWith('/')
    ? trimmed.slice(1)
    : trimmed;
  return `${appUrlBase}/${normalizedPath}`;
};

const ensureInlineMode = (url: string): string => {
  if (/[?&]mode=inline(?:&|$)/.test(url)) {
    return url;
  }
  return `${url}${url.includes('?') ? '&' : '?'}mode=inline`;
};

type ListState = { type: 'ul' | 'ol'; index: number };

type RenderContext = {
  listStack: ListState[];
  inPre: boolean;
};

const escapeInlineCode = (value: string) => value.replace(/[\\`]/g, '\\$&');

const preserveConsecutiveSpaces = (value: string): string =>
  value.replace(/ {2,}/g, (match, offset, full) => {
    const prev = full[offset - 1];
    const next = full[offset + match.length];
    if (!prev || !next || /\s/.test(prev) || /\s/.test(next)) {
      return ' ';
    }
    return ` ${'\u00a0'.repeat(match.length - 1)}`;
  });

const renderNodes = (nodes: DomNode[] | undefined, context: RenderContext): string => {
  if (!nodes?.length) return '';
  return nodes
    .map((node) => renderNode(node, context))
    .filter(Boolean)
    .join('');
};

const wrapInline = (value: string, wrapper: string) => {
  const trimmed = value.trim();
  return trimmed ? `${wrapper}${trimmed}${wrapper}` : '';
};

const renderNode = (node: DomNode, context: RenderContext): string => {
  if (node.type === 'text') {
    const data = (node as DataNode).data ?? '';
    if (!data) return '';
    if (context.inPre) {
      return data;
    }
    const normalized = preserveConsecutiveSpaces(
      data.replace(/\r\n?/g, ' ').replace(/\t/g, ' '),
    );
    const compact = normalized.replace(/\u00a0/g, ' ').trim();
    if (!compact) {
      return normalized.includes('\u00a0') ? normalized : ' ';
    }
    return mdEscape(normalized);
  }
  if (node.type !== 'tag') {
    return '';
  }
  const element = node as Element;
  const name = element.name.toLowerCase();
  switch (name) {
    case 'br':
      return '\n';
    case 'p':
    case 'div':
    case 'section':
    case 'article':
    case 'header':
    case 'footer':
    case 'main':
    case 'aside': {
      const body = renderNodes(element.children as DomNode[], context).trim();
      return body ? `\n${body}\n\n` : '\n';
    }
    case 'strong':
    case 'b':
      return wrapInline(renderNodes(element.children as DomNode[], context), '*');
    case 'em':
    case 'i':
      return wrapInline(renderNodes(element.children as DomNode[], context), '_');
    case 'u':
      return wrapInline(renderNodes(element.children as DomNode[], context), '__');
    case 's':
    case 'del':
    case 'strike':
      return wrapInline(renderNodes(element.children as DomNode[], context), '~');
    case 'code': {
      const content = renderNodes(element.children as DomNode[], {
        ...context,
        inPre: context.inPre,
      });
      if (context.inPre) {
        return escapeInlineCode(content);
      }
      const trimmed = content.trim();
      return trimmed ? `\`${escapeInlineCode(trimmed)}\`` : '';
    }
    case 'pre': {
      const preContent = renderNodes(element.children as DomNode[], {
        ...context,
        inPre: true,
      })
        .replace(/\r\n?/g, '\n')
        .trim();
      if (!preContent) {
        return '';
      }
      return `\n\`\`\`\n${preContent}\n\`\`\`\n\n`;
    }
    case 'ul':
    case 'ol': {
      const nextContext: RenderContext = {
        ...context,
        listStack: [...context.listStack, { type: name as 'ul' | 'ol', index: 0 }],
      };
      const items = (element.children as DomNode[]).map((child) =>
        renderNode(child, nextContext),
      );
      const content = items.filter((item) => item.trim().length > 0).join('\n');
      return content ? `\n${content}\n` : '';
    }
    case 'li': {
      const stack = context.listStack;
      const current = stack[stack.length - 1];
      if (current) {
        current.index += 1;
      }
      const body = renderNodes(element.children as DomNode[], context).trim();
      if (!body) return '';
      const indent = '  '.repeat(Math.max(stack.length - 1, 0));
      const marker =
        current && current.type === 'ol'
          ? `${current.index}\\. `
          : '• ';
      const lines = body.split(/\n+/);
      const firstLine = `${indent}${marker}${lines[0].trimStart()}`;
      const rest = lines
        .slice(1)
        .map((line) => `${indent}  ${line.trimStart()}`)
        .join('\n');
      return rest ? `${firstLine}\n${rest}` : firstLine;
    }
    case 'blockquote': {
      const content = renderNodes(element.children as DomNode[], context).trim();
      if (!content) return '';
      return (
        '\n' +
        content
          .split('\n')
          .map((line) => `> ${line.trim()}`)
          .join('\n') +
        '\n\n'
      );
    }
    case 'a': {
      const href = element.attribs?.href?.trim();
      const labelRaw = renderNodes(element.children as DomNode[], context).trim();
      if (!href) {
        return labelRaw;
      }
      const label = labelRaw || mdEscape(href);
      return `[${label}](${mdEscape(href)})`;
    }
    default:
      return renderNodes(element.children as DomNode[], context);
  }
};

const finalizeMarkdown = (value: string): string =>
  value
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\s+$/g, '')
    .replace(/^\s+/g, '')
    .trim();

export const convertHtmlToMarkdown = (html: string): string => {
  const trimmed = typeof html === 'string' ? html.trim() : '';
  if (!trimmed) return '';
  const document = parseDocument(trimmed, { decodeEntities: true });
  const rendered = renderNodes(document.children as DomNode[], {
    listStack: [],
    inPre: false,
  });
  return finalizeMarkdown(rendered);
};

const extractInlineImages = (html: string): {
  cleanedHtml: string;
  images: InlineImage[];
} => {
  const images: InlineImage[] = [];
  const cleanedHtml = html.replace(/<img\b[^>]*>/gi, (tag) => {
    const srcMatch = tag.match(/\ssrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const rawSrc = srcMatch?.[2] || srcMatch?.[3] || srcMatch?.[4] || '';
    const absolute = rawSrc ? toAbsoluteUrl(rawSrc) : null;
    if (!absolute) {
      return '';
    }
    const inlineUrl = ensureInlineMode(absolute);
    const altMatch = tag.match(/\salt\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const rawAlt = altMatch?.[2] || altMatch?.[3] || altMatch?.[4] || '';
    images.push({ url: inlineUrl, alt: rawAlt ? rawAlt.trim() : undefined });
    return '';
  });
  return { cleanedHtml, images };
};

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
  const link = `${appUrlBase}/tasks?task=${encodeURIComponent(canonicalId)}`;
  return { displayId, link };
};

export default function formatTask(
  task: TaskData,
  users: UsersIndex = {},
): FormatTaskResult {
  const sections: FormatTaskSection[] = [];
  const inlineImages: InlineImage[] = [];

  const headerParts: string[] = [];
  const linkData = buildTaskLink(task);
  let idLine: string | null = null;
  if (linkData) {
    idLine = `📌 [${mdEscape(linkData.displayId)}](${mdEscape(linkData.link)})`;
  } else {
    const fallbackId =
      toIdentifier(task.task_number) ||
      toIdentifier(task.request_id) ||
      toIdentifier(task._id);
    if (fallbackId) {
      idLine = `📌 *${mdEscape(fallbackId)}*`;
    }
  }

  if (idLine) {
    headerParts.push(idLine);
  }

  if (task.task_type) {
    headerParts.push(`🏷 Тип задачи: *${mdEscape(task.task_type)}*`);
  }

  if (task.title) {
    headerParts.push(`📣 *${mdEscape(task.title)}*`);
  } else if (!idLine) {
    const fallbackTitle = toIdentifier(task.task_number);
    if (fallbackTitle) {
      headerParts.push(`📣 *${mdEscape(fallbackTitle)}*`);
    }
  }

  const completionNote = buildCompletionNote(
    task.status,
    task.due_date,
    task.completed_at,
  );
  if (completionNote) {
    headerParts.push(mdEscape(completionNote));
  }
  if (headerParts.length) {
    sections.push({ key: 'header', content: headerParts.join('\n') });
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
    const priorityStyle = resolvePriorityStyle(task.priority);
    infoLines.push(`⚡️ Приоритет: ${emphasizeValue(priority, priorityStyle)}`);
  }
  if (task.status) {
    const statusStyle = resolveStatusStyle(task.status);
    infoLines.push(`🛠 Статус: ${emphasizeValue(task.status, statusStyle)}`);
  }
  const cargoEntries: { label: string; value: string }[] = [];
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
    cargoEntries.push({
      label: 'Д×Ш×В',
      value: `${lengthValue}×${widthValue}×${heightValue} м`,
    });
  } else {
    if (lengthValue) cargoEntries.push({ label: 'Д', value: `${lengthValue} м` });
    if (widthValue) cargoEntries.push({ label: 'Ш', value: `${widthValue} м` });
    if (heightValue) cargoEntries.push({ label: 'В', value: `${heightValue} м` });
  }
  if (typeof task.cargo_volume_m3 === 'number') {
    cargoEntries.push({
      label: 'Объём',
      value: `${metricFormatter.format(task.cargo_volume_m3)} м³`,
    });
  }
  if (typeof task.cargo_weight_kg === 'number') {
    cargoEntries.push({
      label: 'Вес',
      value: `${weightFormatter.format(task.cargo_weight_kg)} кг`,
    });
  }
  const logisticsEnabled =
    typeof task.logistics_enabled === 'boolean'
      ? task.logistics_enabled
      : true;
  if (task.payment_method) {
    infoLines.push(
      `💳 Способ оплаты: ${emphasizeValue(String(task.payment_method), null)}`,
    );
  }
  if (typeof task.payment_amount === 'number') {
    const formatted = currencyFormatter.format(task.payment_amount);
    infoLines.push(
      `💵 Сумма: ${emphasizeValue(`${formatted} грн`, null)}`,
    );
  }
  if (infoLines.length) {
    sections.push({
      key: 'info',
      content: ['🧾 *Информация*', ...infoLines].join('\n'),
    });
  }
  if (logisticsEnabled) {
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
      const distanceValue = `${String(task.route_distance_km)} км`;
      logisticsLines.push(`🗺 Расстояние: ${emphasizeValue(distanceValue, null)}`);
    }
    if (task.transport_type) {
      logisticsLines.push(
        `🚗 Транспорт: ${emphasizeValue(task.transport_type, null)}`,
      );
    }
    if (typeof task.transport_driver_id === 'number') {
      const driverId = task.transport_driver_id;
      logisticsLines.push(`🚘 Водитель: ${userLink(driverId, users[driverId]?.name || users[driverId]?.username)}`);
    }
    if (task.transport_vehicle_name) {
      const vehicleLabel = task.transport_vehicle_registration
        ? `${task.transport_vehicle_name} (${task.transport_vehicle_registration})`
        : task.transport_vehicle_name;
      logisticsLines.push(`🚙 Авто: *${mdEscape(vehicleLabel)}*`);
    }
    if (cargoEntries.length) {
      cargoEntries.forEach(({ label, value }) => {
        logisticsLines.push(`📦 *${mdEscape(label)}*: *${mdEscape(value)}*`);
      });
    }
    if (logisticsLines.length) {
      sections.push({
        key: 'logistics',
        content: ['🧭 *Логистика*', ...logisticsLines].join('\n'),
      });
    }
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
    sections.push({
      key: 'participants',
      content: ['🤝 *Участники*', ...peopleLines].join('\n'),
    });
  }

  if (task.task_description) {
    const { cleanedHtml, images } = extractInlineImages(task.task_description);
    inlineImages.push(...images);
    const lines: string[] = [];
    const formattedDescription = convertHtmlToMarkdown(cleanedHtml);
    if (formattedDescription) {
      lines.push(formattedDescription);
    }
    if (lines.length) {
      sections.push({
        key: 'description',
        content: `📝 *Описание*\n${lines.join('\n')}`,
      });
    }
  }

  return {
    text: sections.map((section) => section.content).join(SECTION_SEPARATOR),
    inlineImages,
    sections,
  };
}

export type { InlineImage, FormatTaskResult, FormatTaskSection };
export { SECTION_SEPARATOR };
