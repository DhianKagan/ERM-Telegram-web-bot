// Назначение файла: модель коллекции флотов
// Основные модули: mongoose
import { Schema, model, Document } from 'mongoose';
import {
  DEFAULT_BASE_URL,
  decodeLocatorKey,
} from '../../services/wialon';

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
}
