// Роуты автопарка: CRUD операции для транспорта
// Модули: express, express-validator, middleware/auth, models/fleet
import { Router, RequestHandler, json } from 'express';
import { param, query } from 'express-validator';
import authMiddleware from '../middleware/auth';
import { Roles } from '../auth/roles.decorator';
import rolesGuard from '../auth/roles.guard';
import { ACCESS_ADMIN } from '../utils/accessMask';
import validateDto from '../middleware/validateDto';
import { CreateFleetDto, UpdateFleetDto } from '../dto/fleets.dto';
import { FleetVehicle, type FleetVehicleAttrs } from '../db/models/fleet';
import createRateLimiter from '../utils/rateLimiter';

const router: Router = Router();
router.use(json());

const limiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  name: 'fleets',
});

const baseMiddlewares = [
  authMiddleware(),
  limiter as unknown as RequestHandler,
];

const adminMiddlewares = [
  ...baseMiddlewares,
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
];

const parseNumber = (value: unknown): number => Number(value);
const parsePosition = (value: unknown): FleetVehicleAttrs['position'] => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  if (value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const lat = Number(record.lat);
  const lon = Number(record.lon);
  const timestampRaw = record.timestamp;
  const timestamp =
    timestampRaw === undefined || timestampRaw === null
      ? undefined
      : timestampRaw instanceof Date
        ? timestampRaw
        : new Date(String(timestampRaw));
  return { lat, lon, timestamp };
};

type FleetVehicleResponseDto = Omit<
  FleetVehicleAttrs,
  'transportHistory' | 'position'
> & {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  transportHistory: {
    taskId: string;
    taskTitle?: string;
    assignedAt?: string;
    removedAt?: string;
  }[];
  position?: {
    lat: number;
    lon: number;
    timestamp?: string;
  } | null;
};

function mapVehicle(
  doc:
    | (FleetVehicleAttrs & { _id: unknown; createdAt?: Date; updatedAt?: Date })
    | null,
): FleetVehicleResponseDto | null {
  if (!doc) return null;
  const base: FleetVehicleResponseDto = {
    id: String((doc as { _id: unknown })._id),
    name: doc.name,
    registrationNumber: doc.registrationNumber,
    odometerInitial: doc.odometerInitial,
    odometerCurrent: doc.odometerCurrent,
    mileageTotal: doc.mileageTotal,
    transportType: doc.transportType ?? 'Легковой',
    fuelType: doc.fuelType,
    fuelRefilled: doc.fuelRefilled,
    fuelAverageConsumption: doc.fuelAverageConsumption,
    fuelSpentTotal: doc.fuelSpentTotal,
    currentTasks: doc.currentTasks,
    position: doc.position
      ? {
          lat: Number(doc.position.lat),
          lon: Number(doc.position.lon),
          timestamp:
            doc.position.timestamp instanceof Date
              ? doc.position.timestamp.toISOString()
              : doc.position.timestamp
                ? String(doc.position.timestamp)
                : undefined,
        }
      : null,
    transportHistory: Array.isArray(doc.transportHistory)
      ? doc.transportHistory.map((entry) => ({
          taskId: entry.taskId,
          taskTitle: entry.taskTitle,
          assignedAt:
            entry.assignedAt instanceof Date
              ? entry.assignedAt.toISOString()
              : entry.assignedAt
                ? String(entry.assignedAt)
                : undefined,
          removedAt:
            entry.removedAt instanceof Date
              ? entry.removedAt.toISOString()
              : entry.removedAt
                ? String(entry.removedAt)
                : undefined,
        }))
      : [],
  };
  if (doc.createdAt) {
    base.createdAt =
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : String(doc.createdAt);
  }
  if (doc.updatedAt) {
    base.updatedAt =
      doc.updatedAt instanceof Date
        ? doc.updatedAt.toISOString()
        : String(doc.updatedAt);
  }
  return base;
}

router.get(
  '/',
  ...baseMiddlewares,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req, res) => {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const search =
      typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { registrationNumber: { $regex: search, $options: 'i' } },
          ],
        }
      : {};
    const [docs, total] = await Promise.all([
      FleetVehicle.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      FleetVehicle.countDocuments(filter),
    ]);
    const items = docs.map((doc) => mapVehicle(doc));
    res.json({ items, total, page, limit });
  },
);

router.post(
  '/',
  ...adminMiddlewares,
  ...(validateDto(CreateFleetDto) as RequestHandler[]),
  async (req, res) => {
    const payload = {
      name: req.body.name as string,
      registrationNumber: String(req.body.registrationNumber).toUpperCase(),
      odometerInitial: parseNumber(req.body.odometerInitial),
      odometerCurrent: parseNumber(req.body.odometerCurrent),
      mileageTotal: parseNumber(req.body.mileageTotal),
      transportType: req.body.transportType,
      fuelType: req.body.fuelType,
      fuelRefilled: parseNumber(req.body.fuelRefilled),
      fuelAverageConsumption: parseNumber(req.body.fuelAverageConsumption),
      fuelSpentTotal: parseNumber(req.body.fuelSpentTotal),
      currentTasks: Array.isArray(req.body.currentTasks)
        ? (req.body.currentTasks as string[]).map((task) => String(task))
        : [],
      position: parsePosition(req.body.position),
    };
    const created = await FleetVehicle.create(payload);
    res.status(201).json(mapVehicle(created.toObject()));
  },
);

router.put(
  '/:id',
  ...adminMiddlewares,
  param('id').isMongoId(),
  ...(validateDto(UpdateFleetDto) as RequestHandler[]),
  async (req, res) => {
    const id = req.params.id;
    const update: Record<string, unknown> = {};
    if (typeof req.body.name === 'string') update.name = req.body.name;
    if (typeof req.body.registrationNumber === 'string') {
      update.registrationNumber = req.body.registrationNumber.toUpperCase();
    }
    if (req.body.odometerInitial !== undefined) {
      update.odometerInitial = parseNumber(req.body.odometerInitial);
    }
    if (req.body.odometerCurrent !== undefined) {
      update.odometerCurrent = parseNumber(req.body.odometerCurrent);
    }
    if (req.body.mileageTotal !== undefined) {
      update.mileageTotal = parseNumber(req.body.mileageTotal);
    }
    if (typeof req.body.transportType === 'string') {
      update.transportType = req.body.transportType;
    }
    if (typeof req.body.fuelType === 'string') {
      update.fuelType = req.body.fuelType;
    }
    if (req.body.fuelRefilled !== undefined) {
      update.fuelRefilled = parseNumber(req.body.fuelRefilled);
    }
    if (req.body.fuelAverageConsumption !== undefined) {
      update.fuelAverageConsumption = parseNumber(
        req.body.fuelAverageConsumption,
      );
    }
    if (req.body.fuelSpentTotal !== undefined) {
      update.fuelSpentTotal = parseNumber(req.body.fuelSpentTotal);
    }
    if (Array.isArray(req.body.currentTasks)) {
      update.currentTasks = (req.body.currentTasks as string[]).map((task) =>
        String(task),
      );
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'position')) {
      update.position = parsePosition(req.body.position);
    }
    const updated = await FleetVehicle.findByIdAndUpdate(id, update, {
      new: true,
    });
    if (!updated) {
      res.sendStatus(404);
      return;
    }
    res.json(mapVehicle(updated.toObject()));
  },
);

router.delete(
  '/:id',
  ...adminMiddlewares,
  param('id').isMongoId(),
  async (req, res) => {
    const deleted = await FleetVehicle.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.sendStatus(404);
      return;
    }
    res.json({ status: 'ok' });
  },
);

export default router;
