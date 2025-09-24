// Назначение файла: синхронизация транспорта флотов из Wialon
// Основные модули: mongoose модели, сервис wialon
import {
  Fleet,
  ensureFleetFields,
  migrateLegacyFleets,
  type FleetDocument,
} from '../db/models/fleet';
import { Vehicle } from '../db/models/vehicle';
import {
  login,
  loadUnits,
  WialonHttpError,
  WialonResponseError,
  type UnitInfo,
  type UnitSensor,
  type UnitPosition,
} from './wialon';

function isSessionInvalidError(error: unknown): boolean {
  if (error instanceof WialonResponseError) {
    return error.code === 1;
  }
  if (error instanceof WialonHttpError) {
    return error.status === 401 || error.status === 403;
  }
  return false;
}

async function persistBaseUrl(
  fleet: FleetDocument,
  nextBaseUrl: string,
): Promise<void> {
  if (fleet.baseUrl === nextBaseUrl) {
    return;
  }
  fleet.baseUrl = nextBaseUrl;
  try {
    await fleet.save();
  } catch (error) {
    console.error(
      `Не удалось сохранить базовый адрес Wialon для флота ${fleet._id}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

function mapPosition(position?: UnitPosition) {
  if (!position) return undefined;
  return {
    lat: position.lat,
    lon: position.lon,
    speed: position.speed,
    course: position.course,
    updatedAt: position.updatedAt,
  };
}

function mapSensor(sensor: UnitSensor) {
  return {
    name: sensor.name,
    type: sensor.type,
    value: sensor.value,
    updatedAt: sensor.updatedAt,
  };
}

async function upsertVehicle(
  fleetId: FleetDocument['_id'],
  unit: UnitInfo,
): Promise<void> {
  const existing = await Vehicle.findOne({ fleetId, unitId: unit.id });
  const position = mapPosition(unit.position);
  const sensors = unit.sensors.map((sensor) => mapSensor(sensor));
  if (!existing) {
    await Vehicle.create({
      fleetId,
      unitId: unit.id,
      name: unit.name,
      remoteName: unit.name,
      position,
      sensors,
    });
    return;
  }
  const previousRemote = existing.remoteName;
  existing.remoteName = unit.name;
  if (!existing.name || existing.name === previousRemote || existing.name === unit.name) {
    existing.name = unit.name;
  }
  existing.position = position;
  existing.sensors = sensors;
  await existing.save();
}

export async function syncFleetVehicles(fleet: FleetDocument): Promise<void> {
  const updatedFleet = await ensureFleetFields(fleet);
  let loginResult = await login(updatedFleet.token, updatedFleet.baseUrl);
  let resolvedBaseUrl = loginResult.baseUrl;
  await persistBaseUrl(updatedFleet, resolvedBaseUrl);
  let units: UnitInfo[];
  try {
    units = await loadUnits(loginResult.sid, resolvedBaseUrl);
  } catch (error) {
    if (!isSessionInvalidError(error)) {
      throw error;
    }
    console.warn(
      `Сессия Wialon недействительна для флота ${updatedFleet._id}, выполняем повторную авторизацию`,
    );
    loginResult = await login(updatedFleet.token, resolvedBaseUrl);
    resolvedBaseUrl = loginResult.baseUrl;
    await persistBaseUrl(updatedFleet, resolvedBaseUrl);
    units = await loadUnits(loginResult.sid, resolvedBaseUrl);
  }
  const ids = units.map((unit) => unit.id);
  await Vehicle.deleteMany({
    fleetId: fleet._id,
    unitId: { $nin: ids },
  });
  for (const unit of units) {
    try {
      await upsertVehicle(fleet._id, unit);
    } catch (error) {
      console.error(
        `Ошибка при обновлении транспорта ${unit.id} флота ${fleet._id}:`,
        error,
      );
    }
  }
}

export async function syncAllFleets(): Promise<void> {
  await migrateLegacyFleets();
  const fleets = await Fleet.find();
  for (const fleet of fleets) {
    try {
      await syncFleetVehicles(fleet);
    } catch (error) {
      console.error(`Не удалось синхронизировать флот ${fleet._id}:`, error);
    }
  }
}
