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
import { Fleet } from '../db/models/fleet';
import { Vehicle, type VehicleAttrs, type VehicleSensor } from '../db/models/vehicle';
import { login, loadTrack } from '../services/wialon';
import type { Types } from 'mongoose';

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
  const fleets = await Fleet.find();
  res.json(fleets);
});

router.post(
  '/',
  ...middlewares,
  ...(validateDto(CreateFleetDto) as RequestHandler[]),
  async (req, res) => {
    const fleet = await Fleet.create(req.body);
    res.status(201).json(fleet);
  },
);

router.put(
  '/:id',
  ...middlewares,
  param('id').isMongoId(),
  ...(validateDto(UpdateFleetDto) as RequestHandler[]),
  async (req, res) => {
    const fleet = await Fleet.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!fleet) {
      res.sendStatus(404);
      return;
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
        sid = (await login(fleet.token)).sid;
      } catch (error) {
        console.error('Не удалось авторизоваться в Wialon:', error);
        res.status(502).json({ error: 'Не удалось получить данные трека' });
        return;
      }
    }

    const vehicles = [] as unknown[];
    for (const doc of docs) {
      const updatedAt =
        doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt;
      const base: Record<string, unknown> = {
        id: String(doc._id),
        unitId: doc.unitId,
        name: doc.name,
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
        ? doc.sensors.map((sensor: VehicleSensor) => ({
            name: sensor.name,
            type: sensor.type,
            value: sensor.value,
            updatedAt:
              sensor.updatedAt instanceof Date
                ? sensor.updatedAt.toISOString()
                : sensor.updatedAt,
          }))
        : [];
      if (includeTrack && sid && trackFrom && trackTo) {
        try {
          const track = await loadTrack(sid, doc.unitId, trackFrom, trackTo);
          base.track = track.map((point) => ({
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
      fleet: { id: String(fleet._id), name: fleet.name },
      vehicles,
    });
  },
);

export default router;
