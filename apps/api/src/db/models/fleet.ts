// Назначение файла: модель коллекции флотов
// Основные модули: mongoose
import { Schema, model, Document, Types } from 'mongoose';
import {
  DEFAULT_BASE_URL,
  decodeLocatorKey,
  parseLocatorLink,
} from '../../services/wialon';
import {
  CollectionItem,
  type CollectionItemDocument,
} from './CollectionItem';

export interface FleetAttrs {
  name: string;
  token: string;
  locatorUrl: string;
  baseUrl: string;
  locatorKey: string;
}

export interface FleetDocument extends FleetAttrs, Document {}

const fleetSchema = new Schema<FleetDocument>({
  name: { type: String, required: true },
  token: { type: String, required: true },
  locatorUrl: { type: String, required: true, default: '' },
  baseUrl: { type: String, required: true, default: DEFAULT_BASE_URL },
  locatorKey: {
    type: String,
    required: true,
    default(this: FleetDocument) {
      return this.token;
    },
  },
});

export const Fleet = model<FleetDocument>('Fleet', fleetSchema);

interface LegacyFleetPayload {
  token?: string;
  locatorUrl?: string;
  locatorKey?: string;
  baseUrl?: string;
}

function encodeLocatorKey(token: string): string {
  return Buffer.from(token, 'utf8').toString('base64');
}

function resolveLocatorHost(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    const protocol = url.protocol === 'http:' ? 'http:' : 'https:';
    const hostname = url.hostname
      ? url.hostname.replace(/^hst-api\./, 'hosting.')
      : 'hosting.wialon.com';
    const port = url.port ? `:${url.port}` : '';
    return `${protocol}//${hostname}${port}`;
  } catch {
    return 'https://hosting.wialon.com';
  }
}

function buildLocatorUrl(baseUrl: string, locatorKey: string): string {
  const host = resolveLocatorHost(baseUrl || DEFAULT_BASE_URL);
  const url = new URL('/locator', host);
  url.searchParams.set('t', locatorKey);
  return url.toString();
}

function parseLegacyValue(value: string): LegacyFleetPayload | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as LegacyFleetPayload;
      if (parsed && (parsed.token || parsed.locatorKey || parsed.locatorUrl)) {
        return parsed;
      }
    } catch {
      /* игнорируем */
    }
  }
  const baseMatch = trimmed.match(/https?:\/\/[^\s]+/);
  const payload: LegacyFleetPayload = {};
  if (baseMatch) {
    payload.baseUrl = baseMatch[0];
  }
  const withoutBase = baseMatch
    ? trimmed.replace(baseMatch[0], '').replace(/[|;,]+/g, ' ').trim()
    : trimmed;
  const parts = withoutBase
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts[0]) {
    const candidate = parts[0];
    try {
      const decoded = decodeLocatorKey(candidate);
      payload.token = decoded;
      payload.locatorKey = candidate;
    } catch {
      payload.token = candidate;
    }
  }
  return payload.token ? payload : null;
}

function normalizeFleetAttrs(
  raw: LegacyFleetPayload,
): Pick<FleetAttrs, 'token' | 'baseUrl' | 'locatorUrl' | 'locatorKey'> | null {
  let token = raw.token?.trim();
  const baseUrl = raw.baseUrl?.trim() || DEFAULT_BASE_URL;
  let locatorKey = raw.locatorKey?.trim();
  if (!token && locatorKey) {
    try {
      token = decodeLocatorKey(locatorKey);
    } catch (error) {
      console.warn(
        'Не удалось расшифровать ключ локатора из устаревших данных автопарка:',
        error instanceof Error ? error.message : error,
      );
      token = locatorKey;
      locatorKey = undefined;
    }
  }
  if (!token && raw.locatorUrl) {
    try {
      const locator = parseLocatorLink(raw.locatorUrl, baseUrl);
      return {
        token: locator.token,
        baseUrl: locator.baseUrl,
        locatorUrl: locator.locatorUrl,
        locatorKey: locator.locatorKey,
      };
    } catch {
      /* игнорируем */
    }
  }
  if (!token) {
    return null;
  }
  if (!locatorKey) {
    try {
      locatorKey = encodeLocatorKey(token);
    } catch (error) {
      console.error(
        'Не удалось подготовить ключ локатора для автопарка:',
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }
  const locatorUrl = buildLocatorUrl(baseUrl, locatorKey);
  return { token, baseUrl, locatorUrl, locatorKey };
}

async function buildFleetAttrsFromCollection(
  item: CollectionItemDocument,
): Promise<Pick<FleetAttrs, 'token' | 'baseUrl' | 'locatorUrl' | 'locatorKey'> | null> {
  try {
    const locator = parseLocatorLink(item.value, DEFAULT_BASE_URL);
    return {
      token: locator.token,
      baseUrl: locator.baseUrl,
      locatorUrl: locator.locatorUrl,
      locatorKey: locator.locatorKey,
    };
  } catch (initialError) {
    const legacy = parseLegacyValue(item.value);
    if (!legacy) {
      console.error(
        `Не удалось восстановить автопарк ${item._id} из коллекции:`,
        initialError instanceof Error ? initialError.message : initialError,
      );
      return null;
    }
    const attrs = normalizeFleetAttrs({
      ...legacy,
      baseUrl: legacy.baseUrl || DEFAULT_BASE_URL,
    });
    if (!attrs) {
      console.error(
        `Не удалось восстановить автопарк ${item._id} из коллекции:`,
        initialError instanceof Error ? initialError.message : initialError,
      );
      return null;
    }
    if (item.value !== attrs.locatorUrl) {
      try {
        item.value = attrs.locatorUrl;
        await item.save();
      } catch (error) {
        console.error(
          `Не удалось обновить ссылку автопарка ${item._id} в коллекции:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
    return attrs;
  }
}

export async function ensureFleetDocument(
  id: Types.ObjectId | string,
): Promise<FleetDocument | null> {
  const existing = await Fleet.findById(id);
  if (existing) {
    return existing;
  }
  const item = await CollectionItem.findById(id);
  if (!item || item.type !== 'fleets') {
    return null;
  }
  const attrs = await buildFleetAttrsFromCollection(item);
  if (!attrs) {
    return null;
  }
  return Fleet.create({
    _id: item._id,
    name: item.name,
    ...attrs,
  });
}

export async function ensureFleetFields(
  fleet: FleetDocument,
): Promise<FleetDocument> {
  let changed = false;
  if (!fleet.locatorUrl) {
    fleet.locatorUrl = '';
    changed = true;
  }
  if (!fleet.baseUrl) {
    fleet.baseUrl = DEFAULT_BASE_URL;
    changed = true;
  }
  if (!fleet.locatorKey) {
    fleet.locatorKey = fleet.token;
    changed = true;
  }
  if (fleet.locatorKey) {
    try {
      const decoded = decodeLocatorKey(fleet.locatorKey);
      if (decoded !== fleet.token) {
        fleet.token = decoded;
        changed = true;
      }
    } catch (error) {
      if (!fleet.token) {
        fleet.token = fleet.locatorKey;
        changed = true;
      }
      if (fleet.locatorKey !== fleet.token) {
        console.warn(
          `Не удалось расшифровать ключ локатора для флота ${fleet._id}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }
  if (changed) {
    await fleet.save();
  }
  return fleet;
}

export async function migrateLegacyFleets(): Promise<void> {
  const legacyFleets = await Fleet.find({
    $or: [
      { locatorUrl: { $exists: false } },
      { baseUrl: { $exists: false } },
      { locatorKey: { $exists: false } },
    ],
  });
  await Promise.all(legacyFleets.map((fleet) => ensureFleetFields(fleet)));
  const fleetItems = await CollectionItem.find({ type: 'fleets' });
  await Promise.all(
    fleetItems.map((item) => ensureFleetDocument(item._id)),
  );
}
