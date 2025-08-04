// Роут расчёта расстояния
// Модули: express, express-validator, services/route
import { Router, RequestHandler } from 'express';
import { body, query } from 'express-validator';
import validate from '../utils/validate';
import {
  getRouteDistance,
  table,
  nearest,
  match,
  trip,
} from '../services/route';
import { verifyToken, asyncHandler } from '../api/middleware';

interface Point {
  lat: number;
  lng: number;
}

interface DistanceBody {
  start: Point;
  end: Point;
}

interface DistanceResponse {
  distance: number;
  route_distance_km?: number;
  [key: string]: unknown;
}

const router = Router();

router.post<unknown, DistanceResponse, DistanceBody>(
  '/',
  verifyToken,
  validate([
    body('start.lat').isFloat(),
    body('start.lng').isFloat(),
    body('end.lat').isFloat(),
    body('end.lng').isFloat(),
  ]),
  asyncHandler((async (req, res) => {
    const data = await getRouteDistance(req.body.start, req.body.end);
    res.json(data);
  }) as RequestHandler<unknown, DistanceResponse, DistanceBody>),
);

interface TableQuery {
  points: string;
  [key: string]: unknown;
}

router.get<unknown, unknown, unknown, TableQuery>(
  '/table',
  verifyToken,
  validate([query('points').isString()]),
  asyncHandler((async (req, res) => {
    const { points, ...params } = req.query as TableQuery;
    res.json(await table(points, params));
  }) as RequestHandler<unknown, unknown, unknown, TableQuery>),
);

interface PointQuery {
  point: string;
  [key: string]: unknown;
}
router.get<unknown, unknown, unknown, PointQuery>(
  '/nearest',
  verifyToken,
  validate([query('point').isString()]),
  asyncHandler((async (req, res) => {
    const { point, ...params } = req.query as PointQuery;
    res.json(await nearest(point, params));
  }) as RequestHandler<unknown, unknown, unknown, PointQuery>),
);

interface PointsQuery {
  points: string;
  [key: string]: unknown;
}
router.get<unknown, unknown, unknown, PointsQuery>(
  '/match',
  verifyToken,
  validate([query('points').isString()]),
  asyncHandler((async (req, res) => {
    const { points, ...params } = req.query as PointsQuery;
    res.json(await match(points, params));
  }) as RequestHandler<unknown, unknown, unknown, PointsQuery>),
);

router.get<unknown, unknown, unknown, PointsQuery>(
  '/trip',
  verifyToken,
  validate([query('points').isString()]),
  asyncHandler((async (req, res) => {
    const { points, ...params } = req.query as PointsQuery;
    res.json(await trip(points, params));
  }) as RequestHandler<unknown, unknown, unknown, PointsQuery>),
);

export default router;

// Совместимость с CommonJS
module.exports = router;
