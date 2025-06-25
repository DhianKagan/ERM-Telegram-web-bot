// Роуты задач: CRUD, время, массовые действия
const express = require('express')
const rateLimit = require('express-rate-limit')
const { body, param, query } = require('express-validator')
const ctrl = require('../controllers/tasks')
const { verifyToken } = require('../api/middleware')

const router = express.Router()

// Лимитирует 100 запросов к детали задачи за 15 минут
const detailLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 })

router.get('/', verifyToken, [
  query('project').optional().isMongoId(),
  query('status').optional().isString(),
  query('assignees').optional().isArray(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601()
], ctrl.list)

router.get('/:id', verifyToken, detailLimiter, [param('id').isMongoId()], ctrl.detail)

router.post('/', verifyToken, [
  body('title').isString().notEmpty(),
  body('task_description').optional().isString(),
  body('task_type').optional().isString(),
  body('task_type_id').optional().isInt(),
  body('location').optional().isString(),
  body('start_location').optional().isString(),
  body('start_location_link').optional().isString(),
  body('end_location').optional().isString(),
  body('end_location_link').optional().isString(),
  body('due_date').optional().isISO8601(),
  body('controller_user_id').optional().isInt(),
  body('created_by').optional().isInt(),
  body('comment').optional().isString(),
  body('priority').optional().isString(),
  body('priority_id').optional().isInt(),
  body('files').optional().isArray(),
  body('assignees').optional().isArray()
], ctrl.create)

router.patch('/:id', verifyToken, [param('id').isMongoId()], ctrl.update)

router.patch('/:id/time', verifyToken, [
  param('id').isMongoId(),
  body('minutes').isInt({ min: 1 })
], ctrl.addTime)

router.delete('/:id', verifyToken, [param('id').isMongoId()], ctrl.remove)

router.post('/bulk', verifyToken, [
  body('ids').isArray({ min: 1 }),
  body('status').isString()
], ctrl.bulk)

router.get('/report/summary', verifyToken, ctrl.summary)

module.exports = router
