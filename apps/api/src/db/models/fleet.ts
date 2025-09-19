// Назначение файла: модель коллекции флотов
// Основные модули: mongoose
import { Schema, model, Types, type HydratedDocument } from 'mongoose';
import { DEFAULT_BASE_URL, decodeLocatorKey } from '../../services/wialon';
import { parseLocatorLink } from '../../utils/wialonLocator';
import { fleetRecoveryFailuresTotal } from '../../metrics';
import {
  CollectionItem,
  type CollectionItemDocument,
  type CollectionItemMeta,
} from './CollectionItem';

export interface FleetAttrs {
  name: string;
  token: string;
  locatorUrl: string;
  baseUrl: string;
  locatorKey: string;
}

export type FleetDocument = HydratedDocument<FleetAttrs>;

export type FleetRecoveryFailureCode =
  | 'invalid_locator_link'
  | 'legacy_payload_invalid';

export interface FleetRecoveryFailure {
  code: FleetRecoveryFailureCode;
  reason: string;
}

export interface EnsureFleetDocumentOptions {
  onFailure?: (failure: FleetRecoveryFailure) => void;
}

type FleetAttrsFromCollectionResult =
  | {
      ok: true;
      attrs: Pick<
        FleetAttrs,
        'token' | 'baseUrl' | 'locatorUrl' | 'locatorKey'
      >;
    }
  | {
      ok: false;
      failure: FleetRecoveryFailure;
    };

function normalizeFailureReason(reason: string | undefined): string {
  if (!reason) {
    return 'Значение автопарка помечено как некорректное';
  }
  const trimmed = reason.trim();
  return trimmed || 'Значение автопарка помечено как некорректное';
}

function extractFailureFromMeta(
  meta?: CollectionItemMeta | null,
): FleetRecoveryFailure | null {
  if (!meta || meta.invalid !== true) {
    return null;
  }
  const code: FleetRecoveryFailureCode =
    meta.invalidCode === 'legacy_payload_invalid'
      ? 'legacy_payload_invalid'
      : 'invalid_locator_link';
  return {
    code,
    reason: normalizeFailureReason(
      typeof meta.invalidReason === 'string' ? meta.invalidReason : undefined,
    ),
  };
}

async function flagCollectionItemInvalid(
  item: CollectionItemDocument,
  failure: FleetRecoveryFailure,
): Promise<void> {
  const meta = (item.meta ?? {}) as CollectionItemMeta;
  if (meta.invalid === true) {
    return;
  }
  const nextMeta: CollectionItemMeta = {
    ...meta,
    invalid: true,
    invalidReason: failure.reason,
    invalidCode: failure.code,
    invalidAt: new Date(),
  };
  item.set('meta', nextMeta);
  item.markModified('meta');
  try {
    await item.save();
  } catch (error) {
    console.error(
      `Не удалось пометить автопарк ${item._id} как некорректный:`,
      error instanceof Error ? error.message : error,
    );
  }
}

const fleetSchema = new Schema<FleetAttrs>({
  name: { type: String, required: true },
  token: { type: String, required: true },
  locatorUrl: { type: String, required: true, default: '' },
  baseUrl: { type: String, required: true, default: DEFAULT_BASE_URL },
  locatorKey: {
    type: String,
    required: true,
    default(this: { token: string }) {
      return this.token;
    },
  },
});

export const Fleet = model<FleetAttrs>('Fleet', fleetSchema);

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

const TOKEN_CANDIDATE_PATTERN = /^[0-9A-Za-z._:+/@=~-]+$/;

function isPrintableToken(value: string): boolean {
  if (!value) {
    return false;
  }
  for (const char of value) {
    const code = char.codePointAt(0);
    if (code === undefined) {
      continue;
    }
    if (code < 0x20 || code > 0x7e) {
      return false;
    }
  }
  return true;
}

function looksLikeTokenCandidate(value: string): boolean {
  if (!value) {
    return false;
  }
  if (value.length < 4 || value.length > 256) {
    return false;
  }
  if (!TOKEN_CANDIDATE_PATTERN.test(value)) {
    return false;
  }
  const lower = value.toLowerCase();
  if (
    lower.includes('http') ||
    lower.includes('://') ||
    lower.includes('link') ||
    lower.includes('locator')
  ) {
    return false;
  }
  return true;
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
    if (candidate) {
      try {
        const decoded = decodeLocatorKey(candidate);
        if (isPrintableToken(decoded)) {
          payload.token = decoded;
          payload.locatorKey = candidate;
        }
      } catch {
        /* игнорируем */
      }
      if (!payload.token && looksLikeTokenCandidate(candidate)) {
        payload.token = candidate;
      }
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
): Promise<FleetAttrsFromCollectionResult> {
  const failureFromMeta = extractFailureFromMeta(item.meta);
  if (failureFromMeta) {
    return { ok: false, failure: failureFromMeta };
  }
  try {
    const locator = parseLocatorLink(item.value, DEFAULT_BASE_URL);
    return {
      ok: true,
      attrs: {
        token: locator.token,
        baseUrl: locator.baseUrl,
        locatorUrl: locator.locatorUrl,
        locatorKey: locator.locatorKey,
      },
    };
  } catch (initialError) {
    const initialReason =
      initialError instanceof Error && initialError.message
        ? initialError.message
        : 'Не удалось разобрать ссылку Wialon';
    const legacy = parseLegacyValue(item.value);
    if (!legacy) {
      const failure: FleetRecoveryFailure = {
        code: 'invalid_locator_link',
        reason: initialReason,
      };
      await flagCollectionItemInvalid(item, failure);
      console.warn(
        `Не удалось восстановить автопарк ${item._id} из коллекции: ${failure.reason}`,
      );
      fleetRecoveryFailuresTotal.inc({ reason: failure.code });
      return { ok: false, failure };
    }
    const attrs = normalizeFleetAttrs({
      ...legacy,
      baseUrl: legacy.baseUrl || DEFAULT_BASE_URL,
    });
    if (!attrs) {
      const failure: FleetRecoveryFailure = {
        code: 'legacy_payload_invalid',
        reason:
          'Устаревшие данные автопарка не содержат валидного токена Wialon',
      };
      await flagCollectionItemInvalid(item, failure);
      console.warn(
        `Не удалось восстановить автопарк ${item._id} из коллекции: ${failure.reason}`,
      );
      fleetRecoveryFailuresTotal.inc({ reason: failure.code });
      return { ok: false, failure };
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
    return { ok: true, attrs };
  }
}

export async function ensureFleetDocument(
  id: Types.ObjectId | string,
  options?: EnsureFleetDocumentOptions,
): Promise<FleetDocument | null> {
  const existing = await Fleet.findById(id);
  if (existing) {
    return existing;
  }
  const item = await CollectionItem.findById(id);
  if (!item || item.type !== 'fleets') {
    return null;
  }
  const failureFromMeta = extractFailureFromMeta(item.meta);
  if (failureFromMeta) {
    options?.onFailure?.(failureFromMeta);
    return null;
  }
  const result = await buildFleetAttrsFromCollection(item);
  if (!result.ok) {
    options?.onFailure?.(result.failure);
    return null;
  }
  return Fleet.create({
    _id: item._id,
    name: item.name,
    ...result.attrs,
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
  const fleetItems = await CollectionItem.find({
    type: 'fleets',
    $or: [
      { 'meta.invalid': { $exists: false } },
      { 'meta.invalid': { $ne: true } },
    ],
  });
  await Promise.all(
    fleetItems.map((item) => ensureFleetDocument(item._id)),
  );
}
