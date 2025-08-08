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
import createRateLimiter from '../utils/rateLimiter';
import { rateLimits } from '../rateLimits';

export interface Point {
  lat: number;
  lng: number;
}

export interface DistanceBody {
  start: Point;
  end: Point;
}

export interface DistanceResponse {
  distance: number;
  route_distance_km?: number;
  [key: string]: unknown;
}

const router = Router();
const routeLimiter = createRateLimiter(rateLimits.route);
const tableLimiter = createRateLimiter(rateLimits.table);

router.post(
  '/',
  routeLimiter as unknown as RequestHandler,
  verifyToken as unknown as RequestHandler,
  validate([
    body('start.lat').isFloat(),
    body('start.lng').isFloat(),
    body('end.lat').isFloat(),
    body('end.lng').isFloat(),
  ]),
  asyncHandler(async (req, res) => {
    const data = await getRouteDistance(req.body.start, req.body.end);
    res.json(data);
  }),
);

interface TableQuery extends Record<string, string> {
  points: string;
}

router.get(
  '/table',
  tableLimiter as unknown as RequestHandler,
  verifyToken as unknown as RequestHandler,
  validate([query('points').isString()]),
  asyncHandler(async (req, res) => {
    const { points, ...params } = req.query as TableQuery;
    res.json(await table(points, params as Record<string, string | number>));
  }),
);

interface PointQuery extends Record<string, string> {
  point: string;
}
router.get(
  '/nearest',
  routeLimiter as unknown as RequestHandler,
  verifyToken as unknown as RequestHandler,
  validate([query('point').isString()]),
  asyncHandler(async (req, res) => {
    const { point, ...params } = req.query as PointQuery;
    res.json(await nearest(point, params as Record<string, string | number>));
  }),
);

interface PointsQuery extends Record<string, string> {
  points: string;
}
router.get(
  '/match',
  routeLimiter as unknown as RequestHandler,
  verifyToken as unknown as RequestHandler,
  validate([query('points').isString()]),
  asyncHandler(async (req, res) => {
    const { points, ...params } = req.query as PointsQuery;
    res.json(await match(points, params as Record<string, string | number>));
  }),
);

router.get(
  '/trip',
  routeLimiter as unknown as RequestHandler,
  verifyToken as unknown as RequestHandler,
  validate([query('points').isString()]),
  asyncHandler(async (req, res) => {
    const { points, ...params } = req.query as PointsQuery;
    res.json(await trip(points, params as Record<string, string | number>));
  }),
);

export default router;
