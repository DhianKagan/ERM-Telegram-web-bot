// Роуты задач: CRUD, время, массовые действия
const express = require('express')
const { body, param, query } = require('express-validator')
const ctrl = require('../controllers/tasks')
const { verifyToken } = require('../api/middleware')

const router = express.Router()

router.get('/', verifyToken, [
  query('project').optional().isMongoId(),
  query('status').optional().isString(),
  query('assignees').optional().isArray(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601()
], ctrl.list)

router.get('/:id', verifyToken, [param('id').isMongoId()], ctrl.detail)

router.post('/', verifyToken, [
  body('title').isString().notEmpty(),
  body('description').optional().isString(),
  body('due_date').optional().isISO8601(),
  body('assignees').optional().isArray()
], ctrl.create)

router.patch('/:id', verifyToken, [param('id').isMongoId()], ctrl.update)

router.patch('/:id/time', verifyToken, [
  param('id').isMongoId(),
  body('minutes').isInt({ min: 1 })
], ctrl.addTime)

router.post('/bulk', verifyToken, [
  body('ids').isArray({ min: 1 }),
  body('status').isString()
], ctrl.bulk)

router.get('/report/summary', verifyToken, ctrl.summary)

module.exports = router
