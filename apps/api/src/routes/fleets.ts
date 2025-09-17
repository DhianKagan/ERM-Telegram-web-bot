// Роуты флотов: CRUD операции
// Модули: express, express-validator, middleware/auth, models/fleet, middleware/validateDto
import { Router, RequestHandler } from 'express';
import createRateLimiter from '../utils/rateLimiter';
import { param } from 'express-validator';
import authMiddleware from '../middleware/auth';
import { Roles } from '../auth/roles.decorator';
import rolesGuard from '../auth/roles.guard';
import { ACCESS_ADMIN } from '../utils/accessMask';
import validateDto from '../middleware/validateDto';
import { CreateFleetDto, UpdateFleetDto } from '../dto/fleets.dto';
import {
  Fleet,
  ensureFleetFields,
  migrateLegacyFleets,
  type FleetAttrs,
} from '../db/models/fleet';
import { Vehicle, type VehicleAttrs, type VehicleSensor } from '../db/models/vehicle';
import { login, loadTrack, parseLocatorLink } from '../services/wialon';
import type { Types } from 'mongoose';
import { syncFleetVehicles } from '../services/fleetVehicles';
import { ReplaceVehicleDto, UpdateVehicleDto } from '../dto/vehicles.dto';

const router: Router = Router();
const limiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  name: 'fleets',
});
const middlewares = [
  limiter as unknown as RequestHandler,
  authMiddleware(),
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
];

router.get('/', ...middlewares, async (_req, res) => {
  await migrateLegacyFleets();
  const fleets = await Fleet.find();
  res.json(fleets);
});

router.post(
  '/',
  ...middlewares,
  ...(validateDto(CreateFleetDto) as RequestHandler[]),
  async (req, res) => {
    const { name, link } = req.body as { name: string; link: string };
    const locator = parseLocatorLink(link);
    const fleet = await Fleet.create({
      name,
      token: locator.token,
      locatorUrl: locator.locatorUrl,
      baseUrl: locator.baseUrl,
      locatorKey: locator.locatorKey,
    });
    try {
      await syncFleetVehicles(fleet);
    } catch (error) {
      console.error('Не удалось синхронизировать транспорт нового флота:', error);
    }
    res.status(201).json(fleet);
  },
);

router.put(
  '/:id',
  ...middlewares,
  param('id').isMongoId(),
  ...(validateDto(UpdateFleetDto) as RequestHandler[]),
  async (req, res) => {
    const update: Partial<
      Pick<FleetAttrs, 'name' | 'token' | 'locatorUrl' | 'baseUrl' | 'locatorKey'>
    > = {};
    if (typeof req.body.name === 'string') {
      update.name = req.body.name;
    }
    if (typeof req.body.link === 'string') {
      const locator = parseLocatorLink(req.body.link);
      update.token = locator.token;
      update.locatorUrl = locator.locatorUrl;
      update.baseUrl = locator.baseUrl;
      update.locatorKey = locator.locatorKey;
    }
    const fleet = await Fleet.findByIdAndUpdate(req.params.id, update, {
      new: true,
    });
    if (!fleet) {
      res.sendStatus(404);
      return;
    }
    try {
      await syncFleetVehicles(fleet);
    } catch (error) {
      console.error(`Не удалось синхронизировать транспорт флота ${fleet._id}:`, error);
    }
    res.json(fleet);
  },
);

router.delete(
  '/:id',
  ...middlewares,
  param('id').isMongoId(),
  async (req, res) => {
    const fleet = await Fleet.findByIdAndDelete(req.params.id);
    if (!fleet) {
      res.sendStatus(404);
      return;
    }
    res.json({ status: 'ok' });
  },
);

function mapSensor(sensor: VehicleSensor) {
  return {
    name: sensor.name,
    type: sensor.type,
    value: sensor.value,
    updatedAt:
      sensor.updatedAt instanceof Date ? sensor.updatedAt.toISOString() : sensor.updatedAt,
  };
}

function mapVehicle(doc: VehicleAttrs & { _id: Types.ObjectId; updatedAt?: Date | string }) {
  const updatedAt =
    doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt;
  const base: Record<string, unknown> = {
    id: String(doc._id),
    unitId: doc.unitId,
    name: doc.name,
    remoteName: doc.remoteName,
    notes: doc.notes ?? '',
    updatedAt,
  };
  if (doc.position) {
    const positionUpdated =
      doc.position.updatedAt instanceof Date
        ? doc.position.updatedAt.toISOString()
        : doc.position.updatedAt;
    base.position = {
      lat: doc.position.lat,
      lon: doc.position.lon,
      speed: doc.position.speed,
      course: doc.position.course,
      updatedAt: positionUpdated,
    };
  }
  base.sensors = Array.isArray(doc.sensors)
    ? doc.sensors.map((sensor: VehicleSensor) => mapSensor(sensor))
    : [];
  base.customSensors = Array.isArray(doc.customSensors)
    ? doc.customSensors.map((sensor: VehicleSensor) => mapSensor(sensor))
    : [];
  return base;
}

router.get(
  '/:id/vehicles',
  ...middlewares,
  param('id').isMongoId(),
  async (req, res) => {
    const fleet = await Fleet.findById(req.params.id);
    if (!fleet) {
      res.sendStatus(404);
      return;
    }
    const updatedFleet = await ensureFleetFields(fleet);

    const includeTrack =
      req.query.track === '1' || req.query.track === 'true' || req.query.track === 'yes';
    let trackFrom: Date | undefined;
    let trackTo: Date | undefined;
    if (includeTrack) {
      const fromRaw = typeof req.query.from === 'string' ? req.query.from : undefined;
      const toRaw = typeof req.query.to === 'string' ? req.query.to : undefined;
      if (!fromRaw || !toRaw) {
        res.status(400).json({ error: 'Для трека требуется указать параметры from и to' });
        return;
      }
      trackFrom = new Date(fromRaw);
      trackTo = new Date(toRaw);
      if (Number.isNaN(trackFrom.getTime()) || Number.isNaN(trackTo.getTime())) {
        res.status(400).json({ error: 'Некорректные параметры даты' });
        return;
      }
      if (trackFrom > trackTo) {
        res.status(400).json({ error: 'Период трека указан неверно' });
        return;
      }
    }

    const docs = ((await Vehicle.find({ fleetId: fleet._id })
      .lean()
      .exec()) as unknown) as (VehicleAttrs & { _id: Types.ObjectId; updatedAt?: Date })[];
    let sid: string | undefined;
    if (includeTrack) {
      try {
        sid = (await login(updatedFleet.token, updatedFleet.baseUrl)).sid;
      } catch (error) {
        console.error('Не удалось авторизоваться в Wialon:', error);
        res.status(502).json({ error: 'Не удалось получить данные трека' });
        return;
      }
    }

    const vehicles = [] as unknown[];
    for (const doc of docs) {
      const base = mapVehicle(doc);
      if (includeTrack && sid && trackFrom && trackTo) {
        try {
          const track = await loadTrack(
            sid,
            doc.unitId,
            trackFrom,
            trackTo,
            updatedFleet.baseUrl,
          );
          (base as Record<string, unknown>).track = track.map((point) => ({
            lat: point.lat,
            lon: point.lon,
            speed: point.speed,
            course: point.course,
            timestamp: point.timestamp.toISOString(),
          }));
        } catch (error) {
          console.error(`Не удалось загрузить трек юнита ${doc.unitId}:`, error);
        }
      }
      vehicles.push(base);
    }

    res.json({
      fleet: { id: String(updatedFleet._id), name: updatedFleet.name },
      vehicles,
    });
  },
);

async function updateVehicle(
  fleetId: string,
  vehicleId: string,
  update: Partial<Pick<VehicleAttrs, 'name' | 'notes' | 'customSensors'>>,
) {
  const vehicle = await Vehicle.findOne({ _id: vehicleId, fleetId });
  if (!vehicle) {
    return null;
  }
  if (update.name !== undefined) {
    vehicle.name = update.name;
  }
  if (update.notes !== undefined) {
    vehicle.notes = update.notes ?? '';
  }
  if (Array.isArray(update.customSensors)) {
    vehicle.customSensors = update.customSensors;
  } else if (update.customSensors === null) {
    vehicle.customSensors = [];
  }
  await vehicle.save();
  return mapVehicle({
    ...(vehicle.toObject() as VehicleAttrs & { _id: Types.ObjectId; updatedAt?: Date | string }),
  });
}

router.patch(
  '/:id/vehicles/:vehicleId',
  ...middlewares,
  param('id').isMongoId(),
  param('vehicleId').isMongoId(),
  ...(validateDto(UpdateVehicleDto) as RequestHandler[]),
  async (req, res) => {
    const { name, notes, customSensors } = req.body as Partial<
      Pick<VehicleAttrs, 'name' | 'notes' | 'customSensors'>
    >;
    const updated = await updateVehicle(req.params.id, req.params.vehicleId, {
      name,
      notes,
      customSensors,
    });
    if (!updated) {
      res.sendStatus(404);
      return;
    }
    res.json(updated);
  },
);

router.put(
  '/:id/vehicles/:vehicleId',
  ...middlewares,
  param('id').isMongoId(),
  param('vehicleId').isMongoId(),
  ...(validateDto(ReplaceVehicleDto) as RequestHandler[]),
  async (req, res) => {
    const { name, notes, customSensors } = req.body as Partial<
      Pick<VehicleAttrs, 'name' | 'notes' | 'customSensors'>
    >;
    const updated = await updateVehicle(req.params.id, req.params.vehicleId, {
      name,
      notes: notes ?? '',
      customSensors: customSensors ?? [],
    });
    if (!updated) {
      res.sendStatus(404);
      return;
    }
    res.json(updated);
  },
);

export default router;
