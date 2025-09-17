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
  type UnitInfo,
  type UnitSensor,
  type UnitPosition,
} from './wialon';

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
  const { sid } = await login(updatedFleet.token, updatedFleet.baseUrl);
  const units = await loadUnits(sid, updatedFleet.baseUrl);
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
