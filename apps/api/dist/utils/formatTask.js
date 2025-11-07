"use strict";
// Форматирование задачи в виде расширенного блока MarkdownV2
// Основные модули: Intl.DateTimeFormat, userLink, config, mdEscape, htmlparser2
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SECTION_SEPARATOR = exports.convertHtmlToMarkdown = void 0;
exports.default = formatTask;
const htmlparser2_1 = require("htmlparser2");
const userLink_1 = __importDefault(require("./userLink"));
const mdEscape_1 = require("./mdEscape");
const taskStatusIcons_1 = require("./taskStatusIcons");
const shared_1 = require("shared");
const config_1 = require("../config");
const toPriorityDisplay = (value) => /^бессроч/i.test(value.trim()) ? 'До выполнения' : value;
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
    timeZone: shared_1.PROJECT_TIMEZONE,
});
const COMPLETION_THRESHOLD_MS = 60000;
const MS_IN_MINUTE = 60 * 1000;
const MINUTES_IN_DAY = 24 * 60;
const parseDateInput = (value) => {
    if (!value) {
        return null;
    }
    const candidate = value instanceof Date ? value : new Date(value);
    return Number.isNaN(candidate.getTime()) ? null : candidate;
};
const getRussianPlural = (value, forms) => {
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
const formatCompletionOffset = (diffMs) => {
    const absValue = Math.abs(diffMs);
    if (absValue < COMPLETION_THRESHOLD_MS) {
        return 'менее минуты';
    }
    const totalMinutes = Math.max(0, Math.floor(absValue / MS_IN_MINUTE));
    const days = Math.floor(totalMinutes / MINUTES_IN_DAY);
    const hours = Math.floor((totalMinutes % MINUTES_IN_DAY) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];
    if (days) {
        parts.push(`${days} ${getRussianPlural(days, ['день', 'дня', 'дней'])}`);
    }
    if (hours) {
        parts.push(`${hours} ${getRussianPlural(hours, ['час', 'часа', 'часов'])}`);
    }
    if (minutes && parts.length < 2) {
        parts.push(`${minutes} ${getRussianPlural(minutes, ['минута', 'минуты', 'минут'])}`);
    }
    if (!parts.length) {
        return 'менее минуты';
    }
    return parts.slice(0, 2).join(' ');
};
const buildCompletionNote = (status, dueValue, completedValue) => {
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
const ACCENT_HEX = '#465fff';
const PRIMARY_HEX = '#2563eb';
const DESTRUCTIVE_HEX = '#f04438';
const ROSE_500_HEX = '#f43f5e';
const SKY_500_HEX = '#0ea5e9';
const SLATE_500_HEX = '#64748b';
const STATUS_COLOR_MAP = {
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
const PRIORITY_COLOR_MAP = {
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
const PRIORITY_COLOR_RULES = [
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
const PRIORITY_COLOR_FALLBACK = {
    fill: { color: ACCENT_HEX, opacity: 0.6 },
    ring: { color: PRIMARY_HEX, opacity: 0.3 },
};
const COLOR_EMOJI_PALETTE = [
    { emoji: '⚪', rgb: [248, 250, 252] },
    { emoji: '🟡', rgb: [250, 204, 21] },
    { emoji: '🟢', rgb: [34, 197, 94] },
    { emoji: '🔴', rgb: [239, 68, 68] },
    { emoji: '🟥', rgb: [244, 63, 94] },
    { emoji: '🟧', rgb: [249, 115, 22] },
    { emoji: '🟦', rgb: [59, 130, 246] },
    { emoji: '⬜', rgb: [241, 245, 249] },
];
const hexToRgb = (value) => {
    const trimmed = value.trim().replace(/^#/, '');
    if (trimmed.length !== 3 && trimmed.length !== 6) {
        return null;
    }
    const normalized = trimmed.length === 3
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
const pickColorEmoji = (value) => {
    const rgb = hexToRgb(value);
    if (!rgb) {
        return null;
    }
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of COLOR_EMOJI_PALETTE) {
        const [cr, cg, cb] = candidate.rgb;
        const distance = (rgb[0] - cr) * (rgb[0] - cr) +
            (rgb[1] - cg) * (rgb[1] - cg) +
            (rgb[2] - cb) * (rgb[2] - cb);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = candidate;
        }
    }
    return best ? best.emoji : null;
};
const resolveStatusStyle = (value) => {
    if (!value) {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    return STATUS_COLOR_MAP[trimmed] ?? null;
};
const resolvePriorityStyle = (value) => {
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
const emphasizeValue = (value, style, options = {}) => {
    const emojiCandidate = style?.fill?.color ? pickColorEmoji(style.fill.color) : null;
    const emoji = (options.fallbackEmoji ?? emojiCandidate) ?? '';
    const escaped = (0, mdEscape_1.escapeMarkdownV2)(value);
    const prefix = emoji ? `${emoji} ` : '';
    return `*${prefix}${escaped}*`;
};
const appUrlBase = config_1.appUrl.replace(/\/+$/, '');
const SECTION_SEPARATOR = '\n\n━━━━━━━━━━━━\n\n';
exports.SECTION_SEPARATOR = SECTION_SEPARATOR;
const HTTP_URL_REGEXP = /^https?:\/\//i;
const toAbsoluteUrl = (value) => {
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    if (HTTP_URL_REGEXP.test(trimmed))
        return trimmed;
    if (trimmed.startsWith('//')) {
        return `https:${trimmed}`;
    }
    if (!appUrlBase)
        return trimmed;
    const normalizedPath = trimmed.startsWith('/')
        ? trimmed.slice(1)
        : trimmed;
    return `${appUrlBase}/${normalizedPath}`;
};
const ensureInlineMode = (url) => {
    if (/[?&]mode=inline(?:&|$)/.test(url)) {
        return url;
    }
    return `${url}${url.includes('?') ? '&' : '?'}mode=inline`;
};
const escapeInlineCode = (value) => value.replace(/[\\`]/g, '\\$&');
const preserveConsecutiveSpaces = (value) => value.replace(/ {2,}/g, (match, offset, full) => {
    const prev = full[offset - 1];
    const next = full[offset + match.length];
    if (!prev || !next || /\s/.test(prev) || /\s/.test(next)) {
        return ' ';
    }
    return ` ${'\u00a0'.repeat(match.length - 1)}`;
});
const renderNodes = (nodes, context) => {
    if (!nodes?.length)
        return '';
    return nodes
        .map((node) => renderNode(node, context))
        .filter(Boolean)
        .join('');
};
const wrapInline = (value, wrapper) => {
    const trimmed = value.trim();
    return trimmed ? `${wrapper}${trimmed}${wrapper}` : '';
};
const renderNode = (node, context) => {
    if (node.type === 'text') {
        const data = node.data ?? '';
        if (!data)
            return '';
        if (context.inPre) {
            return data;
        }
        const normalized = preserveConsecutiveSpaces(data.replace(/\r\n?/g, ' ').replace(/\t/g, ' '));
        const compact = normalized.replace(/\u00a0/g, ' ').trim();
        if (!compact) {
            return normalized.includes('\u00a0') ? normalized : ' ';
        }
        return (0, mdEscape_1.escapeMarkdownV2)(normalized);
    }
    if (node.type !== 'tag') {
        return '';
    }
    const element = node;
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
            const body = renderNodes(element.children, context).trim();
            return body ? `\n${body}\n\n` : '\n';
        }
        case 'strong':
        case 'b':
            return wrapInline(renderNodes(element.children, context), '*');
        case 'em':
        case 'i':
            return wrapInline(renderNodes(element.children, context), '_');
        case 'u':
            return wrapInline(renderNodes(element.children, context), '__');
        case 's':
        case 'del':
        case 'strike':
            return wrapInline(renderNodes(element.children, context), '~');
        case 'code': {
            const content = renderNodes(element.children, {
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
            const preContent = renderNodes(element.children, {
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
            const nextContext = {
                ...context,
                listStack: [...context.listStack, { type: name, index: 0 }],
            };
            const items = element.children.map((child) => renderNode(child, nextContext));
            const content = items.filter((item) => item.trim().length > 0).join('\n');
            return content ? `\n${content}\n` : '';
        }
        case 'li': {
            const stack = context.listStack;
            const current = stack[stack.length - 1];
            if (current) {
                current.index += 1;
            }
            const body = renderNodes(element.children, context).trim();
            if (!body)
                return '';
            const indent = '  '.repeat(Math.max(stack.length - 1, 0));
            const marker = current && current.type === 'ol'
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
            const content = renderNodes(element.children, context).trim();
            if (!content)
                return '';
            return ('\n' +
                content
                    .split('\n')
                    .map((line) => `> ${line.trim()}`)
                    .join('\n') +
                '\n\n');
        }
        case 'a': {
            const href = element.attribs?.href?.trim();
            const labelRaw = renderNodes(element.children, context).trim();
            if (!href) {
                return labelRaw;
            }
            const label = labelRaw || (0, mdEscape_1.escapeMarkdownV2)(href);
            return `[${label}](${(0, mdEscape_1.escapeMarkdownV2)(href)})`;
        }
        default:
            return renderNodes(element.children, context);
    }
};
const finalizeMarkdown = (value) => value
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\s+$/g, '')
    .replace(/^\s+/g, '')
    .trim();
const convertHtmlToMarkdown = (html) => {
    const trimmed = typeof html === 'string' ? html.trim() : '';
    if (!trimmed)
        return '';
    const document = (0, htmlparser2_1.parseDocument)(trimmed, { decodeEntities: true });
    const rendered = renderNodes(document.children, {
        listStack: [],
        inPre: false,
    });
    return finalizeMarkdown(rendered);
};
exports.convertHtmlToMarkdown = convertHtmlToMarkdown;
const extractInlineImages = (html) => {
    const images = [];
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
const isMongoLike = (value) => Boolean(value && typeof value === 'object' && 'toString' in value);
const toIdentifier = (value) => {
    if (value === undefined || value === null)
        return null;
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
const buildTaskLink = (task) => {
    const canonicalId = toIdentifier(task._id) ?? toIdentifier(task.request_id);
    if (!canonicalId)
        return null;
    const displayId = toIdentifier(task.task_number) ||
        toIdentifier(task.request_id) ||
        canonicalId;
    const link = `${appUrlBase}/tasks?task=${encodeURIComponent(canonicalId)}`;
    return { displayId, link };
};
function formatTask(task, users = {}) {
    const sections = [];
    const inlineImages = [];
    const headerParts = [];
    const linkData = buildTaskLink(task);
    let idLine = null;
    if (linkData) {
        idLine = `📌 [${(0, mdEscape_1.escapeMarkdownV2)(linkData.displayId)}](${(0, mdEscape_1.escapeMarkdownV2)(linkData.link)})`;
    }
    else {
        const fallbackId = toIdentifier(task.task_number) ||
            toIdentifier(task.request_id) ||
            toIdentifier(task._id);
        if (fallbackId) {
            idLine = `📌 *${(0, mdEscape_1.escapeMarkdownV2)(fallbackId)}*`;
        }
    }
    if (idLine) {
        headerParts.push(idLine);
    }
    if (task.task_type) {
        headerParts.push(`🏷 Тип задачи: *${(0, mdEscape_1.escapeMarkdownV2)(task.task_type)}*`);
    }
    if (task.title) {
        headerParts.push(`📣 *${(0, mdEscape_1.escapeMarkdownV2)(task.title)}*`);
    }
    else if (!idLine) {
        const fallbackTitle = toIdentifier(task.task_number);
        if (fallbackTitle) {
            headerParts.push(`📣 *${(0, mdEscape_1.escapeMarkdownV2)(fallbackTitle)}*`);
        }
    }
    const completionNote = buildCompletionNote(task.status, task.due_date, task.completed_at);
    if (completionNote) {
        headerParts.push((0, mdEscape_1.escapeMarkdownV2)(completionNote));
    }
    if (headerParts.length) {
        sections.push({ key: 'header', content: headerParts.join('\n') });
    }
    const infoLines = [];
    if (task.start_date) {
        const d = new Date(task.start_date);
        const formatted = taskDateFormatter.format(d).replace(', ', ' ');
        infoLines.push(`🗓 Начало: \`${(0, mdEscape_1.escapeMarkdownV2)(`${formatted} ${shared_1.PROJECT_TIMEZONE_LABEL}`)}\``);
    }
    if (task.due_date) {
        const d = new Date(task.due_date);
        const formatted = taskDateFormatter.format(d).replace(', ', ' ');
        infoLines.push(`⏰ Срок: \`${(0, mdEscape_1.escapeMarkdownV2)(`${formatted} ${shared_1.PROJECT_TIMEZONE_LABEL}`)}\``);
    }
    if (task.priority) {
        const priority = toPriorityDisplay(task.priority);
        const priorityStyle = resolvePriorityStyle(task.priority);
        infoLines.push(`⚡️ Приоритет: ${emphasizeValue(priority, priorityStyle)}`);
    }
    if (task.status) {
        const statusStyle = resolveStatusStyle(task.status);
        const statusIcon = (0, taskStatusIcons_1.getTaskStatusIcon)(task.status);
        infoLines.push(`🛠 Статус: ${emphasizeValue(task.status, statusStyle, statusIcon ? { fallbackEmoji: statusIcon } : undefined)}`);
    }
    const cargoEntries = [];
    const lengthValue = typeof task.cargo_length_m === 'number'
        ? metricFormatter.format(task.cargo_length_m)
        : null;
    const widthValue = typeof task.cargo_width_m === 'number'
        ? metricFormatter.format(task.cargo_width_m)
        : null;
    const heightValue = typeof task.cargo_height_m === 'number'
        ? metricFormatter.format(task.cargo_height_m)
        : null;
    if (lengthValue && widthValue && heightValue) {
        cargoEntries.push({
            label: 'Д×Ш×В',
            value: `${lengthValue}×${widthValue}×${heightValue} м`,
        });
    }
    else {
        if (lengthValue)
            cargoEntries.push({ label: 'Д', value: `${lengthValue} м` });
        if (widthValue)
            cargoEntries.push({ label: 'Ш', value: `${widthValue} м` });
        if (heightValue)
            cargoEntries.push({ label: 'В', value: `${heightValue} м` });
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
    const logisticsEnabled = typeof task.logistics_enabled === 'boolean'
        ? task.logistics_enabled
        : true;
    if (task.payment_method) {
        infoLines.push(`💳 Способ оплаты: ${emphasizeValue(String(task.payment_method), null)}`);
    }
    if (typeof task.payment_amount === 'number') {
        const formatted = currencyFormatter.format(task.payment_amount);
        infoLines.push(`💵 Сумма: ${emphasizeValue(`${formatted} грн`, null)}`);
    }
    if (infoLines.length) {
        sections.push({
            key: 'info',
            content: ['🧾 *Информация*', ...infoLines].join('\n'),
        });
    }
    if (logisticsEnabled) {
        const logisticsLines = [];
        const start = task.start_location ? (0, mdEscape_1.escapeMarkdownV2)(task.start_location) : '';
        const end = task.end_location ? (0, mdEscape_1.escapeMarkdownV2)(task.end_location) : '';
        const startLink = task.start_location_link
            ? `[${start}](${(0, mdEscape_1.escapeMarkdownV2)(task.start_location_link)})`
            : start;
        const endLink = task.end_location_link
            ? `[${end}](${(0, mdEscape_1.escapeMarkdownV2)(task.end_location_link)})`
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
            logisticsLines.push(`🚗 Транспорт: ${emphasizeValue(task.transport_type, null)}`);
        }
        const driverNameRaw = typeof task.transport_driver_name === 'string'
            ? task.transport_driver_name.trim()
            : '';
        const driverIdRaw = task.transport_driver_id;
        if (driverIdRaw !== null && driverIdRaw !== undefined && driverIdRaw !== '') {
            const driverKey = typeof driverIdRaw === 'string' ? driverIdRaw.trim() : driverIdRaw;
            const numericCandidate = typeof driverKey === 'number'
                ? driverKey
                : Number.isFinite(Number(driverKey))
                    ? Number(driverKey)
                    : null;
            const lookupKey = numericCandidate !== null ? numericCandidate : driverKey;
            const userData = users[lookupKey];
            const resolvedName = driverNameRaw ||
                userData?.name ||
                userData?.username ||
                (typeof driverKey === 'string' ? driverKey : String(driverKey));
            const linkId = numericCandidate !== null
                ? numericCandidate
                : typeof driverKey === 'string' && driverKey
                    ? driverKey
                    : driverKey;
            logisticsLines.push(`🚘 Водитель: ${(0, userLink_1.default)(linkId, resolvedName)}`);
        }
        else if (driverNameRaw) {
            logisticsLines.push(`🚘 Водитель: *${(0, mdEscape_1.escapeMarkdownV2)(driverNameRaw)}*`);
        }
        if (task.transport_vehicle_name) {
            const vehicleLabel = task.transport_vehicle_registration
                ? `${task.transport_vehicle_name} (${task.transport_vehicle_registration})`
                : task.transport_vehicle_name;
            logisticsLines.push(`🚙 Авто: *${(0, mdEscape_1.escapeMarkdownV2)(vehicleLabel)}*`);
        }
        if (cargoEntries.length) {
            cargoEntries.forEach(({ label, value }) => {
                logisticsLines.push(`📦 *${(0, mdEscape_1.escapeMarkdownV2)(label)}*: *${(0, mdEscape_1.escapeMarkdownV2)(value)}*`);
            });
        }
        if (logisticsLines.length) {
            sections.push({
                key: 'logistics',
                content: ['🧭 *Логистика*', ...logisticsLines].join('\n'),
            });
        }
    }
    const peopleLines = [];
    if (Array.isArray(task.assignees) && task.assignees.length) {
        const links = task.assignees
            .map((id) => (0, userLink_1.default)(id, users[id]?.name || users[id]?.username))
            .join(', ');
        peopleLines.push(`👥 Исполнители: ${links}`);
    }
    if (Array.isArray(task.controllers) && task.controllers.length) {
        const links = task.controllers
            .map((id) => (0, userLink_1.default)(id, users[id]?.name || users[id]?.username))
            .join(', ');
        peopleLines.push(`🕵 Контроль: ${links}`);
    }
    if (task.created_by) {
        peopleLines.push(`👤 Создатель: ${(0, userLink_1.default)(task.created_by, users[task.created_by]?.name || users[task.created_by]?.username)}`);
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
        const lines = [];
        const formattedDescription = (0, exports.convertHtmlToMarkdown)(cleanedHtml);
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
