// Роут карт: разворачивание ссылок Google Maps
// Модули: express, express-validator, services/maps
import { Router } from 'express'
import { body } from 'express-validator'
import validate from '../utils/validate'
import { expand } from '../controllers/maps'
import { verifyToken, asyncHandler } from '../api/middleware.js'

const router = Router()

router.post(
  '/expand',
  verifyToken,
  validate([body('url').isString().notEmpty()]),
  asyncHandler(expand),
)

export default router

// Совместимость с CommonJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(module as any).exports = router
