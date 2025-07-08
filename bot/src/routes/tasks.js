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
  query('to').optional().isISO8601(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1 })
], ctrl.list)

router.get('/mentioned', verifyToken, ctrl.mentioned)

router.get('/report/summary', verifyToken, [
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601()
], ctrl.summary)

router.get('/:id', verifyToken, detailLimiter, [param('id').isMongoId()], ctrl.detail)

router.post('/', verifyToken, [
  body('title').optional().isString(),
  body('task_description').optional().isString(),
  body('task_type').optional().isString(),
  body('task_type_id').optional().isInt(),
  body('location').optional().isString(),
  body('start_location').optional().isString(),
  body('start_location_link').optional().isString(),
  body('startCoordinates').optional().isObject(),
  body('end_location').optional().isString(),
  body('end_location_link').optional().isString(),
  body('finishCoordinates').optional().isObject(),
  body('route_distance_km').optional().isFloat(),
  body('route_nodes').optional().isArray(),
  body('start_date').optional().isISO8601(),
  body('due_date').optional().isISO8601(),
  body('remind_at').optional().isISO8601(),
  body('controllers').optional().isArray(),
  body('created_by').optional().isInt(),
  body('comment').optional().isString(),
  body('priority').optional().isString(),
  body('priority_id').optional().isInt(),
  body('transport_type').optional().isString(),
  body('payment_method').optional().isString(),
  body('status').optional().isString(),
  body('applicant').optional().isObject(),
  body('logistics_details').optional().isObject(),
  body('procurement_details').optional().isObject(),
  body('work_details').optional().isObject(),
  body('custom_fields').optional(),
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

module.exports = router
