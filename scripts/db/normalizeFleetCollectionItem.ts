// Назначение: нормализация ссылки автопарка в коллекции и перезапуск синхронизации
// Основные модули: mongoose, модели CollectionItem и Fleet, утилиты Wialon
import 'dotenv/config';
import { Types } from 'mongoose';
import connect from '../apps/api/src/db/connection';
import {
  CollectionItem,
  type CollectionItemMeta,
} from '../apps/api/src/db/models/CollectionItem';
import {
  Fleet,
  ensureFleetFields,
} from '../apps/api/src/db/models/fleet';
import { parseLocatorLink } from '../apps/api/src/utils/wialonLocator';
import { DEFAULT_BASE_URL } from '../apps/api/src/services/wialon';
import { syncFleetVehicles } from '../apps/api/src/services/fleetVehicles';

type NormalizedMeta = CollectionItemMeta | undefined;

function usage(): never {
  console.error('Использование: pnpm ts-node scripts/db/normalizeFleetCollectionItem.ts <itemId> <locatorUrl>');
  return process.exit(1);
}

function sanitizeMeta(meta: NormalizedMeta): NormalizedMeta {
  if (!meta) {
    return undefined;
  }
  let changed = false;
  const next: CollectionItemMeta = {};
  for (const [key, value] of Object.entries(meta)) {
    if (
      key === 'invalid' ||
      key === 'invalidReason' ||
      key === 'invalidCode' ||
      key === 'invalidAt'
    ) {
      changed = true;
      continue;
    }
    next[key] = value;
  }
  if (!changed) {
    return meta;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

async function normalizeFleetCollectionItem(id: string, rawValue: string): Promise<void> {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error('Идентификатор коллекции должен быть ObjectId');
  }
  const connection = await connect();
  try {
    const item = await CollectionItem.findById(id);
    if (!item) {
      throw new Error('Элемент коллекции не найден');
    }
    if (item.type !== 'fleets') {
      throw new Error('Указанный элемент не относится к автопаркам');
    }
    const locator = parseLocatorLink(rawValue, DEFAULT_BASE_URL);
    const shouldUpdateValue = item.value !== locator.locatorUrl;
    let metaChanged = false;
    if (shouldUpdateValue) {
      item.value = locator.locatorUrl;
    }
    const currentMeta = item.meta as CollectionItemMeta | undefined;
    const nextMeta = sanitizeMeta(currentMeta);
    if (nextMeta !== currentMeta) {
      item.set('meta', nextMeta);
      metaChanged = true;
    }
    if (shouldUpdateValue || metaChanged) {
      if (metaChanged) {
        item.markModified('meta');
      }
      await item.save();
    }

    let fleet = await Fleet.findById(item._id);
    if (!fleet) {
      fleet = await Fleet.create({
        _id: item._id,
        name: item.name,
        token: locator.token,
        locatorUrl: locator.locatorUrl,
        baseUrl: locator.baseUrl,
        locatorKey: locator.locatorKey,
      });
    } else {
      fleet.token = locator.token;
      fleet.locatorUrl = locator.locatorUrl;
      fleet.baseUrl = locator.baseUrl;
      fleet.locatorKey = locator.locatorKey;
      await fleet.save();
    }

    const updatedFleet = await ensureFleetFields(fleet);
    await syncFleetVehicles(updatedFleet);
  } finally {
    await connection.close();
  }
}

if (require.main === module) {
  const [, , id, locatorUrl] = process.argv;
  if (!id || !locatorUrl) {
    usage();
  }
  normalizeFleetCollectionItem(id, locatorUrl)
    .then(() => {
      console.log('Ссылка автопарка обновлена, синхронизация выполнена');
      process.exit(0);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Ошибка нормализации автопарка:', message);
      process.exit(1);
    });
}
